// CRUD for a child model
// pass { nested: true } as the 3rd options  parameter if you want 
// items to live within the parent vs. in a root 

export default class Model {
  
  constructor(parentModelName, modelName, options) {
    this.parentModelName = parentModelName;
    this.modelName = modelName;
    this.options = options || {};
  }
  
  parentLocation(parentId) {
    //if (this.parentModelName == 'root' || parentId == 'root') return this.modelName;
    if (this.isNested()) return `${this.parentModelName}/${parentId}/${this.modelName}`;
    else return  `${this.parentModelName}-${this.modelName}/${parentId}`;  
  }
  
  itemLocation(parentId, itemId) { return this.parentLocation(parentId) + '/' + itemId };  
  
  isNested() { return typeof(this.options) == "object" && this.options.nested };
  
  write(parentId, itemId, obj, blobs) {    
    //console.log('write() input: ', parentId, itemId, obj, blobs);
    
    if (!parentId || !itemId || typeof(parentId) != 'string' || ( typeof(obj) != 'object' && typeof(obj) != 'null' ) || typeof(itemId) != 'string' ) return Promise.reject('Invalid input provided to write()')        
    else return firebase.database().ref(this.itemLocation(parentId, itemId)).set(obj).then(() => {
      return this.uploadBlobs(parentId, itemId, obj, blobs);
    })
  };
  
  patch(parentId, itemId, obj, blobs) {
    //console.log('parentid ' + parentId, 'itemId ' + itemId, 'obj ' + obj, 'blobs ' + blobs);
    
    if (typeof(obj) !== 'object' || !parentId || typeof(parentId) !== 'string' || !itemId || typeof(itemId) !== 'string') return Promise.reject('Invalid input provided to patch()')
    else {
      var updates = {};
      Object.keys(obj).forEach((key) => {
        updates[this.itemLocation(parentId, itemId) + '/' + key] = obj[key];      
      });
      
      //console.log('updates', updates);
      return firebase.database().ref().update(updates).then(() => {        
        if (blobs) return this.uploadBlobs(parentId, itemId, obj, blobs);
        else return obj
      })
    }
  };
  
  create(parentId, obj, blobs) {
    var newId = obj.id || firebase.database().ref().child(this.parentLocation(parentId)).push().key;
    
    if (typeof(obj) == "object") {
      if (typeof(this.options) == 'object') {
        if (this.options.createdAt) obj.createdAt = firebase.database.ServerValue.TIMESTAMP;
        if (this.options.createdById) obj.createdById = firebase.auth().currentUser.uid;
        if (this.options.createdBy) obj.createdBy = { 
          id: firebase.auth().currentUser.uid,
          displayName: firebase.auth().currentUser.displayName,
          photoURL: firebase.auth().currentUser.photoURL,          
        };
      }
    };
    
    if (this.constructor.name == 'Model') return this.write(parentId, newId, obj, blobs).then((result) => {
      return newId
    });
    else if (['BaseModel','UserModel'].includes(this.constructor.name)) return this.write(newId, obj, blobs).then((result) => {
      return newId
    });
    else return Promise.reject('Oops, ' + this.modelName + ' has no class name -- is your ES2016 parsing setup correctly?')   
  };
  
  remove(parentId, itemId, obj) {
    
    if (typeof(obj) !== 'object' || !parentId || typeof(parentId) !== 'string' || !itemId || typeof(itemId) !== 'string') return Promise.reject('Invalid input provided to delete()')
    else {
      var updates = {};
    
      // delete child model contents with this id (do this before committing delete of parent to reduce orphans due to transport interrupt)
      if (this.options.rootChildren) this.options.rootChildren.forEach((childModelName) => {      

        var childLocation = parentId + '/' + itemId;
        if (parentId == "root") childLocation = itemId;            
        if (typeof(models[childModelName]) == "object") models[childModelName].removeAllChildren(childLocation);
      
        // two lines below actually include the child model in one transaction with the parent
        // which is better, but won't account for blob removal.
        // should create a getRemoveUpdates method that returns a list of database + storage nodes to remove for an object
        // to restore atomic-ish-ness
      
        //var Model = models[this.modelName];
        //updates[Model.itemLocation(parentId,itemId)] = null;      
      
        // switching to a recursive model .remove() call for blob cleanup (not transactional)

      
      });
    
      updates[this.itemLocation(parentId, itemId)] = null;
    
      return firebase.database().ref().update(updates).then(() => {
        // delete blobField objects with this id      
        if (obj && this.options.blobFields) this.deleteBlobs(parentId, itemId, obj)
        else return Promise.resolve('no blobFields defined in model');
      })
      
    }    
  };
  
  removeAllChildren(parentId) {
    
    return firebase.database().ref( this.parentLocation(parentId) ).once('value').then((snapshot) => {
      var itemIds = [];      
      var items = snapshot.val();
      if (items) itemIds = Object.keys(items);
      
      return Promise.all(
        itemIds.map((itemId) => {
          return this.remove(parentId, itemId, items[itemId])
        })
      );
      //else return Promise.resolve('no child objects for ' + parentId + " " + this.modelName)  
    })
    
  };
  
  
  uploadBlobs(parentId, itemId, obj, blobs) {
    if (blobs && typeof(blobs) == "object") return Promise.all(
      Object.keys(blobs).map((blobKey) => {
        var blob = blobs[blobKey];
  
        var imageRef = firebase.storage().ref().child(this.itemLocation(parentId, itemId) + '/' + blobKey + ".jpg");      
  
        return imageRef.put(blob, {contentType: 'image/jpeg'}).then((result) => {
          var addImageUpdate = {};          
          obj[blobKey] = result.downloadURL;
          addImageUpdate[this.itemLocation(parentId, itemId) + '/' + blobKey] = result.downloadURL;
          return firebase.database().ref().update(addImageUpdate).then(() => {
            return obj
          })
        })
        .catch((e) => {
          console.log(e);
        });  
      })
    );
    else return Promise.resolve(obj)    
  };
  
  deleteBlobs(parentId, itemId, obj) {
    // only delete blobs that exist in the obj
    var populatedBlobs = [];
    
    if (this.options.blobFields && Array.isArray(this.options.blobFields)) this.options.blobFields.forEach((blobKey) => {
      if (obj[blobKey]) populatedBlobs.push(blobKey);
    });    
    
    if (populatedBlobs.length) return Promise.all(
      populatedBlobs.map((blobKey) => {
  
        var imageRef = firebase.storage().ref().child(this.itemLocation(parentId, itemId) + '/' + blobKey + ".jpg");      
        return imageRef.delete().then(() => {
          // File deleted successfully
        }).catch((e) => {
          console.log(e)
        });
        
      })
    );
    else return Promise.resolve('No blob fields to delete')    
  };
  
  load(parentId, callback) {    
    var refLocation = this.parentLocation(parentId);
    //console.log('load() refLocation',refLocation);
    
    return firebase.database().ref(refLocation).on('value', (snapshot) => {
      if (typeof(callback) == 'function') callback( snapshot.val()  );      
    });
  };
  
  find(parentId, query, callback) {    
    var refLocation = this.parentLocation(parentId);
    const field = Object.keys(query)[0];
    const value = query[field];
    
    if (typeof(value) != 'object' ) {
      return firebase.database().ref(refLocation).orderByChild(field).equalTo(value).on('value', (snapshot) => {
        if (typeof(callback) == 'function') callback( snapshot.val()  );      
      });    
    } else if (value['start'] && value['end']) {
      
      /*
      Example: 
      let range = {};
      range.start = (new Date).setHours(0,0,0,0);
      range.end = (new Date).setHours(23,59,0,0);
      models.example.find(parentId, { createdAt: range }, function(examples) {
        // do it.
      });
      */
      
      return firebase.database().ref(refLocation).orderByChild(field).startAt(value.start).endAt(value.end).on('value', (snapshot) => {
        if (typeof(callback) == 'function') callback( snapshot.val()  );      
      });        
    }
  };
  
  get(parentId, itemId, callback) {
    //console.log('get(parentId, itemId, callback) params: ', parentId, itemId, callback)
    var refLocation = this.itemLocation(parentId, itemId);
    //console.log('get() refLocation',refLocation);
      
    return firebase.database().ref(refLocation).on('value', (snapshot) => {
      if (typeof(callback) == 'function') callback( snapshot.val() );      
    });
  };
}