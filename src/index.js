import * as Constants from './constants.js';

import Web3 from 'web3';
import Web3HttpProvider from 'web3-providers-http';
import axios from 'axios';
import { BigQuery } from '@google-cloud/bigquery';
import IUniswapV2Factory from '@uniswap/v2-core/build/IUniswapV2Factory.json';

export const main = async (blockchain, exchangeName, numberOfBlocks) => {
    const { web3, expirationTimestamp } = await initializeWeb3(blockchain);
    const { blockCursor, factoryAddress } = await getExchangeData(blockchain, exchangeName);

    // Build Factory contract

    return {
        status: 200,
        message: 'Placeholder Message',
    };
};

const getExchangeData = async (blockchain, exchangeName) => {
    const queryString = `SELECT blockCursor, factoryAddress FROM \`crypto-351521.operations.pool_ingestion_cursor\` WHERE exchangeName = \'${exchangeName}\' AND blockchain = \'${blockchain}\' LIMIT 1`;
    const rows = await query(queryString);
    return {
        blockCursor: rows[0].blockCursor,
        factoryAddress: rows[0].factoryAddress,
    };
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

const initializeWeb3 = async (blockchain) => {
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

    const { token, exp } = await getAccessToken();
    const options = {
        headers: [
            {
                name: 'access-token',
                value: token,
            },
        ],
    };

    const web3 = new Web3(new Web3HttpProvider(Constants.JAM_ETH_NODE_HTTPS, options));
    return {
        web3,
        expirationTimestamp: exp,
    };
};
