import 'dotenv/config';
import express from 'express';
import { main } from './index.js';

const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/', async (req, res) => {
    let start = new Date();
    console.log(`Start Time is: ${start}`);

    let result = await main(req.body);

    let end = new Date();
    console.log(`End Time is: ${end}`);
    console.log(`Time taken: ${(end - start) / 1000} seconds`);
    console.log(result.message);

    res.status(result.status).send(result.message);
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`bigquery-pool-ingestor: listening on port ${PORT}`);
});
