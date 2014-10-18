breeze-mongoose
===============

BreezeJS server-side module that deals with mongoose models

Usage
====

 

 1. Create a function that returns a mongoose model
    
        var mongoose = require('mongoose'),
            
           dbConnection = mongoose.createConnection(mongodb_connection_string),
            
               modelContainer = function getModel(model){ // the name of the model
                   return dbConnection .model(model);
               },

               dbSchemas = dbConnection.models;

 2. Add the **getMetadata** endpoint to your API
        

        var breezeMongoose = require('breeze-mongoose')(modelContainer),

            app.get('breeze/metadata', function(req, res){
                 res.json(breezeMongoose.getMetadata(dbSchemas ));
            })
 3. Add the **saveChanges** endpoint

        app.post(function(req, res){
                breezeMongoose.saveChanges(req.body)
                    .then(function(saveResults){
                     res.json(saveResults);
                })
                .catch(function(message){
                    res.send(500, message);
                });
            });