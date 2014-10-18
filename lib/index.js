
// region Import

var metadataGenerator = require('./metadataGenerator.js'),
    dbManager         = require('./dbManager.js');

// endregion



// region Export

module.exports = function(modelContainer){
	return {
	    getMetadata: metadataGenerator.getMetadata,
	    saveChanges: dbManager(modelContainer)
	};
};

// endregion