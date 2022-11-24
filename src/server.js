import 'dotenv/config';
import express from 'express';
import { main } from './index.js';

const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/', async (req, res) => {
    const exchangeName = req.body.exchangeName;
    const numberOfBlocks = req.body.numberOfBlocks;
    let result = await main(exchangeName, numberOfBlocks);
    res.status(result.status).send(result.message);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`bigquery-pool-ingestor: listening on port ${PORT}`);
});
