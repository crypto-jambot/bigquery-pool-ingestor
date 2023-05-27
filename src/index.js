import { Web3Utils } from '@crypto-jambot/web3-utils';
import { BigQueryUtil } from '@crypto-jambot/bigquery-utils';
import { SecretUtil } from '@crypto-jambot/secret-manager-utils';
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json' assert { type: 'json' };
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json' assert { type: 'json' };

const bqUtil = new BigQueryUtil();
const secretUtil = new SecretUtil();
const V2_TABLE = 'uniswap_v2_pools';
const V3_TABLE = 'uniswap_v3_pools';

export const main = async (requestBody) => {
    const { blockchain, exchangeName, numberOfBlocks, rpcBlockBatchSize } = requestBody;
    const apiKey = await secretUtil.getSecretString(process.env.API_SECRET_KEY);
    const web3 = new Web3Utils(apiKey);
    const ethereum = await web3.getEthereum();
    const latestBlockNumber = await ethereum.getBlockNumber();
    const { blockCursor, factoryAddress, eventName, dataset, table, primaryKey } = await getExchangeData(blockchain, exchangeName);
    const contract = createWeb3Contract(ethereum, table, factoryAddress);
    const endingBlock = Math.min(blockCursor + numberOfBlocks, latestBlockNumber);
    let events = [];

    // Parse through past blocks in batches
    for (let i = blockCursor; i < endingBlock; i += rpcBlockBatchSize) {
        events = events.concat(
            await contract.getPastEvents(eventName, {
                fromBlock: i,
                toBlock: Math.min(i + rpcBlockBatchSize, endingBlock) - 1 /* <----The subtraction makes the endingBlock variable non inclusive */,
            })
        );
    }

    if (events.length === 0) {
        await updateBlockCursor(endingBlock, blockchain, exchangeName);
        return {
            success: true,
            message: `No pairs to ingest. ${exchangeName} on the ${blockchain} blockchain is fully updated.`,
        };
    }

    const rows = events.map((event) => {
        return extractDataFromEvent(exchangeName, event, table);
    });

    // De-duplicate rows
    const duplicateRows = await getDuplicateRows(blockCursor, endingBlock, dataset, table, primaryKey, exchangeName);
    const deduplicatedRows = rows.filter((row) => !duplicateRows.has(row[primaryKey]));

    await bqUtil.insert({ dataset, table, data: deduplicatedRows });
    await updateBlockCursor(endingBlock, blockchain, exchangeName);

    return {
        success: true,
        message: `Inserted ${rows.length} rows into \`${dataset}.${table}\` for the ${blockchain} blockchain.`,
    };
};
const getExchangeData = async (blockchain, exchangeName) => {
    const queryString = `SELECT blockCursor, factoryAddress, poolCreationEventName, dataset, table, primaryKey FROM \`crypto-351521.operations.pool_ingestion_cursor\` WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\' LIMIT 1`;
    const rows = await bqUtil.query(queryString);
    return {
        blockCursor: rows[0].blockCursor,
        factoryAddress: rows[0].factoryAddress,
        eventName: rows[0].poolCreationEventName,
        dataset: rows[0].dataset,
        table: rows[0].table,
        primaryKey: rows[0].primaryKey,
    };
};

const createWeb3Contract = (ethereum, table, factoryAddress) => {
    switch (table) {
        case V3_TABLE:
            return new ethereum.Contract(IUniswapV3Factory.abi, factoryAddress);
        case V2_TABLE:
            return new ethereum.Contract(IUniswapV2Factory.abi, factoryAddress);
    }
};

const extractDataFromEvent = (exchangeName, event, table) => {
    switch (table) {
        case V3_TABLE:
            return {
                exchangeName,
                poolAddress: event.returnValues.pool,
                token0Address: event.returnValues.token0,
                token1Address: event.returnValues.token1,
                fee: event.returnValues.fee,
                tickSpacing: event.returnValues.tickSpacing,
                blockNumber: event.blockNumber,
            };
        case V2_TABLE:
            return {
                exchangeName,
                pairAddress: event.returnValues.pair,
                token0Address: event.returnValues.token0,
                token1Address: event.returnValues.token1,
                index: event.returnValues[3] - 1,
                blockNumber: event.blockNumber,
            };
    }
};

const getDuplicateRows = async (blockCursor, endingBlock, dataset, table, primaryKey, exchangeName) => {
    const queryString = `SELECT ${primaryKey} AS primaryKey FROM \`crypto-351521.${dataset}.${table}\` WHERE blockNumber >= ${blockCursor} AND blockNumber < ${endingBlock} AND exchangeName = '${exchangeName}'`;
    const rows = await bqUtil.query(queryString);
    return new Set(rows.map((row) => row.primaryKey));
};

const updateBlockCursor = async (endingBlock, blockchain, exchangeName) => {
    const queryString = `UPDATE \`crypto-351521.operations.pool_ingestion_cursor\` SET blockCursor = ${endingBlock}, updateTimestamp = CURRENT_TIMESTAMP() WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\'`;
    await bqUtil.query(queryString);
};
