import * as Constants from './constants.js';

import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
import axios from 'axios';
import { BigQuery } from '@google-cloud/bigquery';
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json' assert { type: 'json' };
import IUniswapV3Factory from '@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json' assert { type: 'json' };

const bigQuery = new BigQuery();

export const main = async (requestBody) => {
    const { blockchain, exchangeName, numberOfBlocks, rpcBlockBatchSize } = requestBody;
    const web3 = await initializeWeb3();
    const latestBlockNumber = await web3.eth.getBlockNumber();
    const { blockCursor, factoryAddress, eventName, dataset, table, primaryKey } = await getExchangeData(blockchain, exchangeName);
    const contract = createWeb3Contract(web3, exchangeName, factoryAddress);
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

    if (events.length == 0) {
        return {
            success: true,
            message: `No pairs to ingest. ${exchangeName} on the ${blockchain} blockchain is fully updated.`,
        };
    }

    const rows = events.map((event) => {
        return extractDataFromEvent(exchangeName, event);
    });

    // De-duplicate rows
    const duplicateRows = await getDuplicateRows(blockCursor, endingBlock, dataset, table, primaryKey, exchangeName);
    const deduplicatedRows = rows.filter((row) => !duplicateRows.has(row[primaryKey]));

    await bigQuery.dataset(dataset).table(table).insert(deduplicatedRows);
    await updateBlockCursor(endingBlock, blockchain, exchangeName);

    return {
        success: true,
        message: `Inserted ${rows.length} rows into \`${dataset}.${table}\` for the ${blockchain} blockchain.`,
    };
};

const initializeWeb3 = async () => {
    const getAccessToken = async () => {
        const config = {
            method: 'get',
            url: Constants.JAM_ETH_NODE_AUTH,
            headers: {
                'api-key': process.env.API_KEY,
            },
        };
        const response = await axios(config);
        return response.data.token;
    };

    const { token } = await getAccessToken();
    const options = {
        headers: [
            {
                name: 'Authorization',
                value: `Bearer ${token}`,
            },
        ],
    };

    return new Web3(new Web3HttpProvider(Constants.JAM_ETH_NODE_HTTPS, options));
};

const getExchangeData = async (blockchain, exchangeName) => {
    const queryString = `SELECT blockCursor, factoryAddress, poolCreationEventName, dataset, table, primaryKey FROM \`crypto-351521.operations.pool_ingestion_cursor\` WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\' LIMIT 1`;
    const rows = await query(queryString);
    return {
        blockCursor: rows[0].blockCursor,
        factoryAddress: rows[0].factoryAddress,
        eventName: rows[0].poolCreationEventName,
        dataset: rows[0].dataset,
        table: rows[0].table,
        primaryKey: rows[0].primaryKey,
    };
};

const createWeb3Contract = (web3, exchangeName, factoryAddress) => {
    switch (exchangeName) {
        case 'uniswapV3':
            return new web3.eth.Contract(IUniswapV3Factory.abi, factoryAddress);
        default:
            return new web3.eth.Contract(IUniswapV2Factory.abi, factoryAddress);
    }
};

const extractDataFromEvent = (exchangeName, event) => {
    switch (exchangeName) {
        case 'uniswapV3':
            return {
                poolAddress: event.returnValues.pool,
                token0Address: event.returnValues.token0,
                token1Address: event.returnValues.token1,
                fee: event.returnValues.fee,
                tickSpacing: event.returnValues.tickSpacing,
                blockNumber: event.blockNumber,
            };
        default:
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
    let queryString;
    switch (exchangeName) {
        case 'uniswapV3':
            queryString = `SELECT ${primaryKey} AS primaryKey FROM \`crypto-351521.${dataset}.${table}\` WHERE blockNumber >= ${blockCursor} AND blockNumber < ${endingBlock}`;
            break;
        default:
            queryString = `SELECT ${primaryKey} AS primaryKey FROM \`crypto-351521.${dataset}.${table}\` WHERE blockNumber >= ${blockCursor} AND blockNumber < ${endingBlock} AND exchangeName = '${exchangeName}'`;
    }
    const rows = await query(queryString);
    return new Set(rows.map((row) => row.primaryKey));
};

const updateBlockCursor = async (endingBlock, blockchain, exchangeName) => {
    const queryString = `UPDATE \`crypto-351521.operations.pool_ingestion_cursor\` SET blockCursor = ${endingBlock}, updateTimestamp = CURRENT_TIMESTAMP() WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\'`;
    await query(queryString);
};

const query = async (queryString) => {
    const options = {
        query: queryString,
        location: 'US',
    };
    const [job] = await bigQuery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
};
