const express = require('express');
const logger = require('morgan');
const { graphqlHTTP } = require('express-graphql');
const schema = require('./schemas/graphqlSchema');
const mongoose = require('mongoose');
const githubRouter = require('./routes/github');

const url = 'MongoURLHere';
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

// This route will be used as an endpoint to interact with Graphql, 
// All queries will go through this route. 
app.use('/graphql', graphqlHTTP({
    // directing express-graphql to use this schema to map out the graph 
    schema,
    // directing express-graphql to use graphiql when goto '/graphql' address in the browser
    // which provides an interface to make GraphQl queries
    graphiql: true
}));
app.use('/github', githubRouter);

app.listen(3000, () => {
    console.log('Listening on port 3000');
});