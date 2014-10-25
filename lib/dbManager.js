// region Import

var Promise             = require('bluebird'),
    _                   = require('lodash'),
    metadataGenerator   = require('./metadataGenerator.js');

// endregion

// region Enums

var EntityState = {
    ADDED: 'Added',
    MODIFIED: 'Modified',
    DELETED: 'Deleted'
};

// endregion

// region Consts

var BREEZE_RELATED_PROPS = ['entityAspect'],
    NAMESPACE = metadataGenerator.namespace,
    BREEZE_MONGOOSE_NS = 'breeze.mongoose';

// endregion

// region Inner Fields

var modelContainer,
    itemsProcessed,
    currentId,
    saveResults;

// endregion

// region Inner Methods

var
    /**
     * Performs all the crud tasks defined in the save bundle
     * @param saveBundle
     */
    saveChanges = function saveChanges(saveBundle){
        return new Promise(function(resolve, reject){
            _initState();
            var numOfItemsToProcess = saveBundle.entities.length;

            saveBundle.entities.forEach(_processEntity.bind(null, function(error){
                reject(error);
            }));

            setTimeout(__poll, 0);

            function __poll(){
                if(itemsProcessed === numOfItemsToProcess){
                    resolve(saveResults);
                } else {
                    setTimeout(__poll, 0);
                }
            }
        });
    },

    /**
     * Initialized the state of this singleton
     * @private
     */
    _initState = function _initState(){
        itemsProcessed = 0,
        currentId = 1,
        saveResults = {
            $id: currentId++,
            $type: BREEZE_MONGOOSE_NS + '.SaveResult, ' + BREEZE_MONGOOSE_NS,
            Entities: [],
            KeyMappings: []
        };
    },

    /**
     * Processes the given entity info which contains information about the entity
     * @param entityInfo
     * @private
     */
    _processEntity = function _processEntity(errClb, entityInfo){
        var entityType = _getModelName(entityInfo.entityAspect.entityTypeName);

        switch(entityInfo.entityAspect.entityState){
            case EntityState.ADDED :
                _addNewEntity(entityInfo, entityType, errClb);
                break;
            case EntityState.MODIFIED :
                _updateEntity(entityInfo, entityType, errClb);
                break;
            case EntityState.DELETED :
                _deleteEntity(entityInfo, entityType, errClb);
                break;
            default :
                throw new Error('The given entity state is not recognized');
        }
    },

    /**
     * Adds an entity based on the given entityInfo
     * @param entityInfo
     * @param entityType
     * @private
     */
    _addNewEntity = function _addNewEntity(entityInfo, entityType, errClb){
        var tempId = entityInfo.id,
            EntityModel = modelContainer(entityType),
            entityDataInfo = _getEntityFromInfo(entityInfo),
            entityData = entityDataInfo[0],
            embededDocuments = entityDataInfo[1];

        // remove Id when adding
        delete entityData.id;

        var entity = new EntityModel(entityData);

        // Add embedded documents
        embededDocuments.forEach(function(embededDoc){
            entity[embededDoc.key] = [embededDoc.value];
        });

        entity.save(function(err){
            if(err) {
                errClb(err)
            }

            EntityModel.findById(entity, function (err, doc) {
                if (err) {
                    return errClb(err);
                }

                saveResults.Entities.push(_getBreezeEntityFromNewDoc(doc, entityType, entityInfo));
                saveResults.KeyMappings.push(_addKeyMappingsEntry(doc, entityType, tempId));
                itemsProcessed++;
            })
        });
    },

    /**
     * Updates an entity based on the given entityInfo
     * @param entityInfo
     * @private
     */
    _updateEntity = function _updateEntity(entityInfo, entityType, errClb){
        var EntityModel = modelContainer(entityType),
            entityDataInfo = _getEntityFromInfo(entityInfo),
            entityData = entityDataInfo[0],
            embededDocuments = entityDataInfo[1];

        embededDocuments.forEach(function(embededDoc){
            entityData[embededDoc.key] = [embededDoc.value];
        });

        EntityModel.findByIdAndUpdate(entityData.id, entityData, null, function(err, entity){
            if(err) {
                errClb(err);
            }

            saveResults.Entities.push(_getBreezeEntityFromDto(entity, entityType));
            itemsProcessed++;
        });
    },

    /**
     * Deletes an entity based on the givne entityInfo
     * @param entityInfo
     * @param entityType
     * @private
     */
    _deleteEntity = function _deleteEntity(entityInfo, entityType, errClb){
        var EntityModel = modelContainer(entityType),
            entityDataInfo = _getEntityFromInfo(entityInfo),
            entityData = entityDataInfo[0];

        EntityModel.findByIdAndRemove(entityData.id, null, function(err, entity){
            if(err) {
                errClb(err);
            }

            saveResults.Entities.push(_getBreezeEntityFromDto(entity, entityType));
            itemsProcessed++;
        });
    },

    /**
     * Returns the model name parsing the string that breeze uses to
     * recognize model names
     * @param breezeModelName
     * @private
     */
    _getModelName = function _getModelName(breezeModelName){
        return breezeModelName.split(':')[0];
    },

    /**
     * Returns an object that contains just the properties of the entity.
     * All properties related to breezeJS are removed
     * @param entityInfo
     * @private
     */
    _getEntityFromInfo = function _getEntityFromInfo(entityInfo){
        var embededDocuments = [];

        BREEZE_RELATED_PROPS.forEach(function(prop){
            delete entityInfo[prop];
        });

        // find embedded documents
        _.forOwn(entityInfo, function(value, key){
            if(_.isPlainObject(value)){
                embededDocuments.push({
                    key: key,
                    value: value
                });
            }
        });

        return [entityInfo, embededDocuments];
    },

    /**
     * Turns the given mongoose newly create document into a breeze entity
     * @param doc
     * @param entityType
     * @private
     */
    _getBreezeEntityFromNewDoc = function _getBreezeEntityFromNewDoc(doc, entityType, entityInfo){
        var entity = {
            $id: currentId++,
            $type: _getTypeName(entityType),
            id: doc._id.toString()
        };

        return _.extend(entity, entityInfo);
    },

    /**
     * Turns the given dto send from client into a breeze entity
     * @param dto
     * @param entityType
     * @private
     */
    _getBreezeEntityFromDto = function _getBreezeEntityFromDto(dto, entityType){
        var entity = {
            $id: currentId++,
            $type: _getTypeName(entityType),
            id: dto.id
        };

        return _.extend(entity, dto.schema.methods.serialize(dto._doc));
    },

    /**
     * Returns an entry for the KeyMappings array
     * @param doc
     * @param entityType
     * @param tempId
     * @returns {{$id: number, $type: string, EntityTypeName: string, TempValue: *, RealValue: *}}
     * @private
     */
    _addKeyMappingsEntry = function _addKeyMappingsEntry(doc, entityType, tempId){
        return {
            $id: currentId++,
            $type: BREEZE_MONGOOSE_NS + '.KeyMapping, ' + BREEZE_MONGOOSE_NS,
            EntityTypeName: NAMESPACE + '.' + entityType,
            TempValue: tempId,
            RealValue: doc._id.toString()
        };
    },

    /**
     * return the name for the given type, which breeze will understand
     * @param type
     * @private
     */
    _getTypeName = function(type){
        return NAMESPACE + '.' + type + ', ' + NAMESPACE;
    };

// endregion

// region Export

module.exports = function(_modelContainer_){
    modelContainer = _modelContainer_;

    return saveChanges;
}

// endregion