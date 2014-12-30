// region Export

module.exports = function(modelContainer, namespace){
	var metadataGenerator = require('./metadataGenerator.js')(namespace || 'models.app'),
    	dbManager         = require('./dbManager.js')(namespace || 'models.app');


	return {
	    getMetadata: metadataGenerator.getMetadata,
	    saveChanges: dbManager.saveChanges
	};
};

// endregion