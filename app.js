// Dotenv
require('dotenv').config();

const express = require('express');
const logger = require('morgan');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./schemas/graphqlSchema');
const mongoose = require('mongoose');
const githubRouter = require('./routes/github');
const validateSecret = require('./utils/validate');

const API_SECRET = process.env.API_SECRET;

const url = process.env.MONGO_URL;
const connect = mongoose.connect(url, {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

connect.then(() => console.log('Connected correctly to the database!'),
    err => console.error('Error connecting to mongo...', err));

const app = express();

app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: false }));
// Github route
app.use('/github', githubRouter);

app.use((req, res, next) => {
    // Validate hash from query params before processing graphql
    isValid = validateSecret(`sha256=${req.query.hash}`, req.body.query, API_SECRET);
    if (isValid) {
        next();
    } else {
        // We can't go on without a valid hash
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.json({ error: 'Could not validate hash...' });
    }
});
// This route will be used as an endpoint to interact with Graphql, 
// All queries will go through this route. 
app.use('/graphql', graphqlHTTP({
    // directing express-graphql to use this schema to map out the graph 
    schema,
    // directing express-graphql to use graphiql when goto '/graphql' address in the browser
    // which provides an interface to make GraphQl queries
    graphiql: true
}));

app.listen(process.env.PORT || 4000, () => {
    console.log(`Listening on port: ${process.env.PORT || 4000}`);
});