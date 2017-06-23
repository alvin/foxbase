// CRUD for a child model
// pass { nested: true } as the 3rd options  parameter if you want 
// items to live within the parent vs. in a root 
//import slugify from 'underscore.string';

export default class Model {
  
  constructor(parentModelName, modelName, options) {
    this.parentModelName = parentModelName;
    this.modelName = modelName;
    this.options = options || {};
  }
  
  parentLocation(parentId) {
    if (this.parentModelName == 'root' || parentId == 'root') return `${this.parentModelName}-${this.modelName}`;
    if (this.isNested()) return `${this.parentModelName}/${parentId}/${this.modelName}`;
    else return  `${this.parentModelName}-${this.modelName}/${parentId}`;  
  }
  
  itemLocation(parentId, itemId) { return this.parentLocation(parentId) + '/' + itemId };  
  
  resolveForeignPath(parentId, itemId, field, fieldValue) {
    var parentPath = `${parentId ? parentId : ''}/`
    if (typeof(parentId) == 'undefined' || parentId == 'root') parentPath = '';
    return `${field}-${this.modelName}/${parentPath}${fieldValue}/${itemId}`
  }
  
  isNested() { return typeof(this.options) == "object" && this.options.nested };
  
  getForeignRefUpdates(parentId, itemId, obj) {
    var refUpdates = {};
    
    if (this.options.foreignIdRefs) this.options.foreignIdRefs.forEach((field) => {      
      if (obj && typeof(obj) == 'object' && typeof(obj[field]) != 'undefined' ) {
        if (obj[field] && obj[field].length) obj[field].forEach((value, idx) => {
          refUpdates[this.resolveForeignPath(parentId, itemId, field, value)] = true;            
        })
      }
            
    });
    return refUpdates;
  }

  preprocessForeignRefs(parentId, itemId, obj) {
    if (!this.options.foreignIdRefs) return Promise.resolve(obj);
    else {
      return firebase.database().ref(this.itemLocation(parentId,itemId)).once('value')
        .then((snapshot) => {
          
          var item = snapshot.val();
          var removeRefs = {};
          
          if (item) {
            
            this.options.foreignIdRefs.forEach((field) => {      
              if (item && typeof(item) == 'object' && typeof(item[field]) != 'undefined' ) {
                if (item[field] && item[field].length) item[field].forEach((value, idx) => {
                  if ( (typeof(obj[field]) != 'undefined' && !obj[field]) || !obj[field].includes(value)) { // the old value is gone or isn't in the new array, delete the foreign ref!
                    removeRefs[this.resolveForeignPath(parentId, itemId, field, value)] = null;                            
                  }
                })
              }            
            });
            
            
          }
          
          return firebase.database().ref().update( removeRefs);
          
        })
        .catch((e) => {
          console.log(e);
        })
        
    }
   
  }
  
  write(parentId, itemId, obj, blobs) {    
    //console.log('write() input: ', parentId, itemId, obj, blobs);
    
    if (!parentId || !itemId || typeof(parentId) != 'string' || ( typeof(obj) != 'object' && typeof(obj) != 'null' && typeof(obj) != 'string'&& typeof(obj) != 'boolean' ) || typeof(itemId) != 'string' ) { 
      return Promise.reject('Invalid input provided to write()');
    } else { 
      
        return this.preprocessForeignRefs(parentId, itemId, obj).then(() => {
          return firebase.database().ref(this.itemLocation(parentId, itemId)).set( obj )                 
        })
        .then(() => {
          return firebase.database().ref().update( this.getForeignRefUpdates(parentId, itemId, obj) )          
        })
        .then(() => {
          return this.uploadBlobs(parentId, itemId, obj, blobs);
        })
        .catch((e) => {
          console.log(e);
        });  
      
    }
  };
  
  
  patch(parentId, itemId, obj, blobs) {
    //console.log('parentid ' + parentId, 'itemId ' + itemId, 'obj ' + obj, 'blobs ' + blobs);
    
    if (typeof(obj) !== 'object' || !parentId || typeof(parentId) !== 'string' || !itemId || typeof(itemId) !== 'string') return Promise.reject('Invalid input provided to patch()')
    else {
      var updates = {};
      Object.keys(obj).forEach((key) => {
        updates[this.itemLocation(parentId, itemId) + '/' + key] = obj[key];      
      });

      updates = Object.assign(updates, this.getForeignRefUpdates(parentId, itemId, obj));
      
      //console.log('updates', updates);
      return this.preprocessForeignRefs(parentId, itemId, obj)
        .then(() => {
          return firebase.database().ref().update(updates)
        })
        .then(() => {        
          if (blobs) return this.uploadBlobs(parentId, itemId, obj, blobs);
          else return obj
        })
    }
  };
  
  create(parentId, obj, blobs) {
    var newId = obj.id || firebase.database().ref().child(this.parentLocation(parentId)).push().key;
    if (typeof(obj.id) == 'string' && !this.options.keepIdProp) { 
      if (_.size(obj) == 1) obj = true;
      else delete(obj.id);
    }
    if (typeof(obj) == "object") {
      if (typeof(this.options) == 'object') {
        if (this.options.createdAt) obj.createdAt = firebase.database.ServerValue.TIMESTAMP;
        if (this.options.createdById) obj.createdById = firebase.auth().currentUser.uid;
        if (this.options.createdByEmail) obj.createdByEmail = firebase.auth().currentUser.email;
        if (this.options.createdBy) obj.createdBy = { 
          id: firebase.auth().currentUser.uid,
          displayName: firebase.auth().currentUser.displayName,
          photoURL: firebase.auth().currentUser.photoURL,          
        };
      }
    };
    
    if (this.constructor.name == 'Model') return this.write(parentId, newId, obj, blobs)
      .then((result) => {
        return newId
      });
    else if (['BaseModel','UserModel'].includes(this.constructor.name)) return this.write(newId, obj, blobs).then((result) => {
      return newId
    });
    else return Promise.reject('Oops, ' + this.modelName + ' has no class name -- is your ES2016 parsing setup correctly?')   
  };
  
  remove(parentId, itemId, updates) {
    
    if (!parentId || typeof(parentId) !== 'string' || !itemId || typeof(itemId) !== 'string') return Promise.reject('Invalid input provided to remove()')
    else {
      if (typeof(updates) != 'object') updates = {};
      
      var blobRefs = [];
      var childRefs = {};
      
      if (this.options.rootChildren) this.options.rootChildren.forEach((childModelName) => {      
      
        const childModel = models[childModelName];
        const childRef = childModel.itemLocation(parentId,itemId);
        childRefs[childModelName] = childRef;
        updates[childRef] = null;  
              
      
      });

      
      return firebase.database().ref(this.itemLocation(parentId,itemId)).once('value')
        .then((snapshot) => {
          var item = snapshot.val();
          return item;
        })
        .then((item) => {
          if (this.options.foreignIdRefs) this.options.foreignIdRefs.forEach((field) => {      
            if (typeof(field) == "string" && item && item[field]) {              
              if (item && item[field].length) item[field].forEach((fieldValue, idx) => {
                var foreignPath = this.resolveForeignPath(parentId, itemId, field, fieldValue);                
                updates[foreignPath] = null;            
              })
            }
          });
          return item;
          
        })
        .then((item) => {
          // comb thru existing object looking for blobs
          if (item && this.options.blobFields && Array.isArray(this.options.blobFields)) this.options.blobFields.forEach((blobKey) => {
            if (item[blobKey]) blobRefs.push(`${this.itemLocation(parentId,itemId)}/${blobKey}.jpg`);
          });                
        
        })
        .then(() => {
          // comb thru all child items looking for populated blob values
          // add said locations to blobRefs[] for deletion below post update()
          return Promise.all(
            _.map(Object.keys(childRefs).forEach((modelName) => {
              const ref = childRefs[modelName];
              const model = models[modelName];
          
              return firebase.database().ref(ref).once('value')
                .then((snapshot) => {
                  var itemIds = [];      
                  var items = snapshot.val();
              
                  if (items) Object.keys(items).forEach((itemId) => {
                    if (model.options.blobFields && Array.isArray(model.options.blobFields)) model.options.blobFields.forEach((blobKey) => {
                      var item = items[itemId];
                      if (item[blobKey]) blobRefs.push(`${ref}/${itemId}/${blobKey}.jpg`);
                    });                
                  })
                })
            }))
          )
        
        })
        .then(() => {
    
          updates[this.itemLocation(parentId, itemId)] = null;
          return firebase.database().ref().update(updates)
            .then(() => {
               return Promise.all(
                _.map(blobRefs, (blobRef) => {
                  return firebase.storage().ref().child(blobRef).delete()
                  .then(() => {
                    //console.log(blobRef + " deleted.")
                    // File deleted successfully
                  }).catch((e) => {
                    console.log(e)
                  });
              
                })
              )
            })
      
        })
      
    }    
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