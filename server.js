import express from 'express';
import cors from 'cors';
import 'dotenv/config'
import connectDB from './configs/mongodb.js';
import { clerkWebhooks } from './controllers/webhooks.js';


const app = express();

app.use(cors());
connectDB();


app.get('/',(req,res) => res.send("Api Is Working"))
app.post('/clerk',express.json(),clerkWebhooks)


const PORT = process.env.PORT || 5000;

app.listen(PORT,() => {
    console.log(`Server Is Running on port ${PORT}`)
})