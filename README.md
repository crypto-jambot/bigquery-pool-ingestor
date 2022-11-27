# bigquery-pool-ingestor

This repository ingests historical pool data on an ad hoc basis.

## How to use it

This application is a Cloud Run API that executes when you make a POST call to "/" and give it the following:

Your request body can be an object or an array of objects:

```
{
    "blockchain": "ethereum",
    "exchangeName": "uniswapV2",
    "numberOfBlocks": 500000,
    "rpcBlockBatchSize": 10000
}
```

OR

```
[
    {
        "blockchain": "ethereum",
        "exchangeName": "uniswapV2",
        "numberOfBlocks": 500000,
        "rpcBlockBatchSize": 10000
    },
    {
        "blockchain": "ethereum",
        "exchangeName": "uniswapV2",
        "numberOfBlocks": 500000,
        "rpcBlockBatchSize": 10000
    }
]
```

You must provide all of the following in your request:

-   blockchain - The blockchain the exchange lives on.
-   exchangeName - The name of the decentralized exchange.
-   numberOfblocks - Starting from the last processed block recorded, how many blocks should be processed for past events.
-   rpcBlockBatchSize - How many blocks should the API call at a time for data. (Synchronous)

The response will be an object or an array of objects depending on what your input was:

```
{
    "success": true,
    "message": "No pairs to ingest. uniswapV2 on the ethereum blockchain is fully updated."
}
```

OR

```
[
    {
        "success": true,
        "message": "No pairs to ingest. uniswapV2 on the ethereum blockchain is fully updated."
    },
    {
        "success": true,
        "message": "No pairs to ingest. uniswapV2 on the ethereum blockchain is fully updated."
    }
]
```

## How it works

For each object in your request body, the main method will be executed and do the following:

1. Initialize a web3 http connection to a node
2. Call BQ for metadata about the state of ingestion for the particular exchange
3. Request all past events from the node between a certain range of block numbers
4. Extract and transform data of the events returned into the schema of the destination BQ table
5. Filter out liquidity pool data that already exists in the destination table
6. Insert data into BQ and update the state of ingestion for the particular exchange

## External Dependencies

This API is intended to work only if the following infrustructure is in place

-   A dataset in BQ called <code>operations</code> and a table inside that dataset called <code>pool_ingestion_cursor</code>
-   The schema for the table listed above must adhere at a minumum spec to the schema below:

```
[
  {
    "description": "The name of the blockchain that the exchange lives on",
    "mode": "REQUIRED",
    "name": "blockchain",
    "type": "STRING"
  },
  {
    "description": "The name of the decentralized exchange",
    "mode": "REQUIRED",
    "name": "exchangeName",
    "type": "STRING"
  },
  {
    "description": "The blockNumber for which we have ingested all pool creation events prior to and including the block",
    "mode": "REQUIRED",
    "name": "blockCursor",
    "type": "INTEGER"
  },
  {
    "description": "The address of the factory contract",
    "mode": "NULLABLE",
    "name": "factoryAddress",
    "type": "STRING"
  },
  {
    "description": "The name of the event emitted when a liquidity pool is created using the factory contract",
    "mode": "NULLABLE",
    "name": "poolCreationEventName",
    "type": "STRING"
  },
  {
    "description": "The name of the BQ dataset where pool data lives",
    "mode": "NULLABLE",
    "name": "dataset",
    "type": "STRING"
  },
  {
    "description": "The name of the BQ table where pool data lives",
    "mode": "NULLABLE",
    "name": "table",
    "type": "STRING"
  },
  {
    "description": "The name of the unique identifier of the liquidity pool for the exchange protocol",
    "mode": "NULLABLE",
    "name": "primaryKey",
    "type": "STRING"
  }
]
```

-   A destination table where liquidity pool data should be send to. It must have a primaryKey column that is used to remove duplicate data before ingestion.

## Current supported exchanges:

-   Uniswap V2 protocol
-   Uniswap V3 protocol
