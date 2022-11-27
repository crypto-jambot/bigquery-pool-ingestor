import express from 'express';
import { main } from './index.js';

const PORT = process.env.PORT ?? 8080;
const app = express();
app.use(express.json()); // for parsing application/json
app.use(express.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.post('/', async (req, res) => {
    let start = new Date();
    console.log(`Start Time is: ${start.toLocaleString({ timezone: 'CST' })}`);

    let result;
    if (Array.isArray(req.body)) {
        result = [];
        for (const item of req.body) {
            try {
                result.push(await main(item));
            } catch (err) {
                result.push({
                    success: false,
                    message: `Something went wrong when ingesting pools for ${item.exchangeName} on the ${item.blockchain} blockchain.`,
                    error: err,
                });
            }
        }
    } else {
        try {
            result = await main(req.body);
        } catch (err) {
            result = {
                success: false,
                message: `Something went wrong when ingesting pools for ${req.body.exchangeName} on the ${req.body.blockchain} blockchain.`,
                error: err,
            };
        }
    }

    let end = new Date();
    console.log(`End Time is: ${end.toLocaleString({ timezone: 'CST' })}`);
    console.log(`Time taken: ${(end - start) / 1000} seconds`);
    console.log(result);

    res.json(result);
});

app.listen(PORT, () => {
    console.log(`bigquery-pool-ingestor: listening on port ${PORT}`);
});
