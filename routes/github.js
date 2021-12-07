const express = require('express');
const Git = require('nodegit');
const archiver = require('archiver');
const fs = require('fs');
const AWS = require('aws-sdk');
const Plugin = require('../models/plugin');
const Pusher = require('../models/pusher');
const { resolve, dirname } = require('path');

const AWS_ID = 'AWSIDHERE';
const AWS_SECRET = 'AWSSECRETHERE';
const AWS_BUCKET = 'my-test-plugin-bucket';

const s3 = new AWS.S3({
    accessKeyId: AWS_ID,
    secretAccessKey: AWS_SECRET
});

const githubRouter = express.Router();

githubRouter.route('/')
    .post(async (req, res, next) => {
        // Very first thing is to check if this was a push to the default branch
        let parts = req.body.ref.split('/');
        if (parts.includes(req.body.repository.default_branch)) {
            // Then I want to check to see if this Pusher already exists
            // getPusherID will return the existing ID or create a Pusher and return its ID
            const pusherID = await getPusherID(req.body.pusher);
            if (pusherID) {
                // Next let's see if this Plugin has run before
                // plugin will be {pluginID: id of existing plugin, zips: zips array from existing plugin}
                // or
                // null
                const plugin = await getPluginID(req.body.repository.full_name);
                if (plugin) {
                    // Get the new zips array
                    const zips = await getNewZipsArray(req.body.repository.name, req.body.repository.html_url, plugin.zips);
                    // We just need to update the Plugin!
                    Plugin.findByIdAndUpdate(plugin.pluginID, {
                        $set: {
                            name: req.body.repository.name,
                            fullName: req.body.repository.full_name,
                            private: req.body.repository.private,
                            htmlUrl: req.body.repository.html_url,
                            defaultBranch: req.body.repository.default_branch,
                            pushedAt: req.body.repository.pushed_at,
                            updatedAt: req.body.repository.updated_at,
                            createdAt: req.body.repository.created_at,
                            zips: zips,
                            pusherID: pusherID
                        }
                    }, { new: true })
                        .then(plugin => {
                            console.log('Plugin updated!', plugin);
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.json({ plugin: plugin });
                        })
                        .catch(err => next(err));
                } else {
                    // Create the new zips array
                    const zips = await getNewZipsArray(req.body.repository.name, req.body.repository.html_url, []);
                    // We will create a new Plugin entry!
                    Plugin.create({
                        name: req.body.repository.name,
                        fullName: req.body.repository.full_name,
                        private: req.body.repository.private,
                        htmlUrl: req.body.repository.html_url,
                        defaultBranch: req.body.repository.default_branch,
                        pushedAt: req.body.repository.pushed_at,
                        updatedAt: req.body.repository.updated_at,
                        createdAt: req.body.repository.created_at,
                        zips: zips,
                        pusherID: pusherID
                    })
                        .then(plugin => {
                            console.log('Plugin created!', plugin);
                            res.statusCode = 200;
                            res.setHeader('Content-Type', 'application/json');
                            res.json({ plugin: plugin });
                        })
                        .catch(err => next(err));
                }
            } else {
                // We can't go on without the Pusher
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.json({ error: 'Could not get pusherID...' });
            }
        } else {
            // Ignore this push...
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.json({ message: 'Not a push to the default branch.' });
        }
    });

// HELPER FUNCTIONS
function getPusherID(data) {
    return new Promise((resolve) => {
        Pusher.findOne({ email: data.email })
            .then(pusher => {
                if (pusher) {
                    console.log('Pusher found!', pusher);
                    // We already had this Pusher stored!
                    resolve(pusher._id);
                } else {
                    console.log('No pusher found...');
                    // If there is no Pusher, let's create one!
                    Pusher.create(data)
                        .then(pusher => {
                            console.log('Pusher created!', pusher);
                            resolve(pusher._id);
                        })
                        .catch(err => {
                            console.log(err);
                            resolve(null);
                        });
                }
            })
            .catch(err => {
                console.log(err);
                resolve(null);
            });
    });
}
function getPluginID(fullName) {
    return new Promise((resolve) => {
        Plugin.findOne({ fullName: fullName })
            .then(plugin => {
                if (plugin) {
                    console.log('Plugin found!', plugin);
                    // We already have handled this Plugin before!
                    resolve({
                        pluginID: plugin._id,
                        zips: plugin.zips
                    });
                } else {
                    console.log('No plugin found...');
                    resolve(null);
                }
            });
    });
}

function getNewZipsArray(pluginName, htmlUrl, oldZips) {
    const repoName = pluginName;
    const zipName = `${repoName}.zip`;
    const key = `${repoName}.${Date.now()}.zip`;

    return new Promise((resolve) => {
        // First let's clone the repo!
        Git.Clone(htmlUrl, repoName)
            .then(repo => {
                console.log('Repo cloned!');
                // Next we will zip up the directory we just made
                zipDirectory(repoName, zipName)
                    .then(res => {
                        console.log('Zipped the repo!');
                        // Next we will upload the zip and get the URL!
                        uploadZip(zipName, key)
                            .then(zipUrl => {
                                // Clean up the repo and zip
                                fs.rmSync(repoName, { recursive: true, force: true });
                                fs.rmSync(zipName, { recursive: true, force: true });
                                // Finally we will push the new URL into the previous array!
                                resolve([...oldZips, zipUrl]);
                            })
                            .catch(err => {
                                // Clean up the repo and zip
                                fs.rmSync(repoName, { recursive: true, force: true });
                                fs.rmSync(zipName, { recursive: true, force: true });
                                resolve(oldZips);
                            });
                    })
                    .catch(err => {
                        // Clean up the repo
                        fs.rmSync(repoName, { recursive: true, force: true });
                        console.log('Error zipping the repo...');
                        resolve(oldZips);
                    });
            })
            .catch(err => {
                console.log('Error cloning repo...', err);
                resolve(oldZips);
            });
    });
}

function zipDirectory(source, out) {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const stream = fs.createWriteStream(out);

    return new Promise((resolve, reject) => {
        archive
            .directory(source)
            .on('error', err => reject(err))
            .pipe(stream);

        stream.on('close', () => resolve());
        archive.finalize();
    });
}

function uploadZip(zip, key) {
    const fileContent = fs.readFileSync(zip);

    const params = {
        Bucket: AWS_BUCKET,
        Key: key,
        Body: fileContent,
        ACL: 'public-read'
    };

    return new Promise((resolve, reject) => {
        s3.upload(params, (err, data) => {
            if (err) {
                console.log('Error uploading zip...', err);
                reject(err);
            } else {
                console.log('Uploaded zip successfully!', data);
                resolve(data.Location);
            }
        });
    });
}

module.exports = githubRouter;