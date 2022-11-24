import { BigQuery } from '@google-cloud/bigquery';

export const main = async (blockchain, exchangeName, numberOfBlocks) => {
    const blockCursor = await getBlockCursor(blockchain, exchangeName);

    return {
        status: 200,
        message: 'Placeholder Message',
    };
};

const getBlockCursor = async (blockchain, exchangeName) => {
    const queryString = `SELECT blockNumber FROM \`crypto-351521.operations.pool_ingestion_cursor\` WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\' LIMIT 1`;
    const rows = await query(queryString);
    return rows[0].blockNumber;
};

const query = async (queryString) => {
    const bigQuery = new BigQuery();
    const options = {
        query: queryString,
        location: 'US',
    };
    const [job] = await bigQuery.createQueryJob(options);
    const [rows] = await job.getQueryResults();
    return rows;
};
