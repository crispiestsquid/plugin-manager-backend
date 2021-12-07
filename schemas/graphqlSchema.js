const graphql = require('graphql');
const Plugin = require('../models/plugin');
const Pusher = require('../models/pusher');

const {
    GraphQLObjectType, GraphQLString,
    GraphQLID, GraphQLInt, GraphQLBoolean, GraphQLSchema,
    GraphQLList, GraphQLNonNull
} = graphql;

// Schema defines data on the Graph like object types(book type), relation between 
// these object types and describes how it can reach into the graph to interact with 
// the data to retrieve or mutate the data

const PluginType = new GraphQLObjectType({
    name: 'Plugin',
    fields: () => ({
        id: { type: GraphQLID },
        name: { type: GraphQLString },
        fullName: { type: GraphQLString },
        private: { type: GraphQLBoolean },
        htmlUrl: { type: GraphQLString },
        defaultBranch: { type: GraphQLString },
        pushedAt: { type: GraphQLString },
        updatedAt: { type: GraphQLString },
        createdAt: { type: GraphQLString },
        zips: { type: new GraphQLList(GraphQLString) },
        pusher: {
            type: PusherType,
            resolve(parent, args) {
                return Pusher.findById(parent.pusherID);
            }
        }
    })
});

const PusherType = new GraphQLObjectType({
    name: 'Pusher',
    fields: () => ({
        id: { type: GraphQLID },
        name: { type: GraphQLString },
        email: { type: GraphQLString },
        plugin: {
            type: new GraphQLList(PluginType),
            resolve(parent, args) {
                return Plugin.find({ pusherID: parent.id });
            }
        }
    })
});

// RootQuery describe how users can use the graph and grab data.
// E.g Root query to get all authors, get all books, get a particular 
// book or get a particular author.
const RootQuery = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
        plugin: {
            type: PluginType,
            // argument passed by the user while making the query
            args: { id: { type: GraphQLID } },
            resolve(parent, args) {
                // Here we define how to get data from database source

                // this will return the book with id passed in argument 
                // by the user
                return Plugin.findById(args.id);
            }
        },
        plugins: {
            type: new GraphQLList(PluginType),
            resolve(parent, args) {
                return Plugin.find({});
            }
        },
        pusher: {
            type: PusherType,
            args: { id: { type: GraphQLID } },
            resolve(parent, args) {
                return Pusher.findById(args.id);
            }
        },
        pushers: {
            type: new GraphQLList(PusherType),
            resolve(parent, args) {
                return Pusher.find({});
            }
        }
    }
});

// Very similar to RootQuery helps user to add/update to the database.
const Mutation = new GraphQLObjectType({
    name: 'Mutation',
    fields: {
        addPusher: {
            type: PusherType,
            args: {
                // GraphQLNonNull make these field required
                name: { type: new GraphQLNonNull(GraphQLString) },
                email: { type: new GraphQLNonNull(GraphQLString) }
            },
            resolve(parent, args) {
                let pusher = new Pusher({
                    name: args.name,
                    email: args.email
                });
                return pusher.save();
            }
        },
        addPlugin: {
            type: PluginType,
            args: {
                name: { type: new GraphQLNonNull(GraphQLString) },
                fullName: { type: new GraphQLNonNull(GraphQLString) },
                private: { type: new GraphQLNonNull(GraphQLBoolean) },
                htmlUrl: { type: new GraphQLNonNull(GraphQLString) },
                defaultBranch: { type: new GraphQLNonNull(GraphQLString) },
                pushedAt: { type: new GraphQLNonNull(GraphQLString) },
                updatedAt: { type: new GraphQLNonNull(GraphQLString) },
                createdAt: { type: new GraphQLNonNull(GraphQLString) },
                zips: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) },
                pusherID: { type: new GraphQLNonNull(GraphQLID) }
            },
            resolve(parent, args) {
                let plugin = new Plugin({
                    name: args.name,
                    fullName: args.fullName,
                    private: args.private,
                    htmlUrl: args.htmlUrl,
                    defaultBranch: args.defaultBranch,
                    pushedAt: args.pushedAt,
                    updatedAt: args.updatedAt,
                    createdAt: args.createdAt,
                    zips: args.zips,
                    pusherID: args.pusherID
                });
                return plugin.save();
            }
        }
    }
});

// Creating a new GraphQL Schema, with options query which defines query 
// we will allow users to use when they are making request.
module.exports = new GraphQLSchema({
    query: RootQuery,
    mutation: Mutation
});