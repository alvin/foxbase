'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// CRUD for a child model
// pass { nested: true } as the 3rd options  parameter if you want 
// items to live within the parent vs. in a root 

var Model = function () {
  function Model(parentModelName, modelName, options) {
    _classCallCheck(this, Model);

    this.parentModelName = parentModelName;
    this.modelName = modelName;
    this.options = options || {};
  }

  _createClass(Model, [{
    key: 'parentLocation',
    value: function parentLocation(parentId) {
      //if (this.parentModelName == 'root' || parentId == 'root') return this.modelName;
      if (this.isNested()) return this.parentModelName + '/' + parentId + '/' + this.modelName;else return this.parentModelName + '-' + this.modelName + '/' + parentId;
    }
  }, {
    key: 'itemLocation',
    value: function itemLocation(parentId, itemId) {
      return this.parentLocation(parentId) + '/' + itemId;
    }
  }, {
    key: 'isNested',
    value: function isNested() {
      return _typeof(this.options) == "object" && this.options.nested;
    }
  }, {
    key: 'write',
    value: function write(parentId, itemId, obj, blobs) {
      var _this = this;

      //console.log('write() input: ', parentId, itemId, obj, blobs);

      if (!parentId || !itemId || typeof parentId != 'string' || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) != 'object' && typeof obj != 'null' && typeof obj != 'string' || typeof itemId != 'string') return Promise.reject('Invalid input provided to write()');else return firebase.database().ref(this.itemLocation(parentId, itemId)).set(obj).then(function () {
        return _this.uploadBlobs(parentId, itemId, obj, blobs);
      });
    }
  }, {
    key: 'patch',
    value: function patch(parentId, itemId, obj, blobs) {
      var _this2 = this;

      //console.log('parentid ' + parentId, 'itemId ' + itemId, 'obj ' + obj, 'blobs ' + blobs);

      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || !parentId || typeof parentId !== 'string' || !itemId || typeof itemId !== 'string') return Promise.reject('Invalid input provided to patch()');else {
        var updates = {};
        Object.keys(obj).forEach(function (key) {
          updates[_this2.itemLocation(parentId, itemId) + '/' + key] = obj[key];
        });

        //console.log('updates', updates);
        return firebase.database().ref().update(updates).then(function () {
          if (blobs) return _this2.uploadBlobs(parentId, itemId, obj, blobs);else return obj;
        });
      }
    }
  }, {
    key: 'create',
    value: function create(parentId, obj, blobs) {
      var newId = obj.id || firebase.database().ref().child(this.parentLocation(parentId)).push().key;

      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) == "object") {
        if (_typeof(this.options) == 'object') {
          if (this.options.createdAt) obj.createdAt = firebase.database.ServerValue.TIMESTAMP;
          if (this.options.createdById) obj.createdById = firebase.auth().currentUser.uid;
          if (this.options.createdBy) obj.createdBy = {
            id: firebase.auth().currentUser.uid,
            displayName: firebase.auth().currentUser.displayName,
            photoURL: firebase.auth().currentUser.photoURL
          };
        }
      };

      if (this.constructor.name == 'Model') return this.write(parentId, newId, obj, blobs).then(function (result) {
        return newId;
      });else if (['BaseModel', 'UserModel'].includes(this.constructor.name)) return this.write(newId, obj, blobs).then(function (result) {
        return newId;
      });else return Promise.reject('Oops, ' + this.modelName + ' has no class name -- is your ES2016 parsing setup correctly?');
    }
  }, {
    key: 'remove',
    value: function remove(parentId, itemId, obj) {
      var _this3 = this;

      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || !parentId || typeof parentId !== 'string' || !itemId || typeof itemId !== 'string') return Promise.reject('Invalid input provided to remove()');else {
        var updates = {};

        // delete child model contents with this id (do this before committing delete of parent to reduce orphans due to transport interrupt)
        if (this.options.rootChildren) this.options.rootChildren.forEach(function (childModelName) {

          var childLocation = parentId + '/' + itemId;
          if (parentId == "root") childLocation = itemId;
          if (_typeof(models[childModelName]) == "object") models[childModelName].removeAllChildren(childLocation);

          // two lines below actually include the child model in one transaction with the parent
          // which is better, but won't account for blob removal.
          // should create a getRemoveUpdates method that returns a list of database + storage nodes to remove for an object
          // to restore atomic-ish-ness

          //var Model = models[this.modelName];
          //updates[Model.itemLocation(parentId,itemId)] = null;      

          // switching to a recursive model .remove() call for blob cleanup (not transactional)

        });

        updates[this.itemLocation(parentId, itemId)] = null;

        return firebase.database().ref().update(updates).then(function () {
          // delete blobField objects with this id      
          if (obj && _this3.options.blobFields) _this3.deleteBlobs(parentId, itemId, obj);else return Promise.resolve('no blobFields defined in model');
        });
      }
    }
  }, {
    key: 'removeAllChildren',
    value: function removeAllChildren(parentId) {
      var _this4 = this;

      return firebase.database().ref(this.parentLocation(parentId)).once('value').then(function (snapshot) {
        var itemIds = [];
        var items = snapshot.val();
        if (items) itemIds = Object.keys(items);

        return Promise.all(itemIds.map(function (itemId) {
          return _this4.remove(parentId, itemId, items[itemId]);
        }));
        //else return Promise.resolve('no child objects for ' + parentId + " " + this.modelName)  
      });
    }
  }, {
    key: 'uploadBlobs',
    value: function uploadBlobs(parentId, itemId, obj, blobs) {
      var _this5 = this;

      if (blobs && (typeof blobs === 'undefined' ? 'undefined' : _typeof(blobs)) == "object") return Promise.all(Object.keys(blobs).map(function (blobKey) {
        var blob = blobs[blobKey];

        var imageRef = firebase.storage().ref().child(_this5.itemLocation(parentId, itemId) + '/' + blobKey + ".jpg");

        return imageRef.put(blob, { contentType: 'image/jpeg' }).then(function (result) {
          var addImageUpdate = {};
          obj[blobKey] = result.downloadURL;
          addImageUpdate[_this5.itemLocation(parentId, itemId) + '/' + blobKey] = result.downloadURL;
          return firebase.database().ref().update(addImageUpdate).then(function () {
            return obj;
          });
        }).catch(function (e) {
          console.log(e);
        });
      }));else return Promise.resolve(obj);
    }
  }, {
    key: 'deleteBlobs',
    value: function deleteBlobs(parentId, itemId, obj) {
      var _this6 = this;

      // only delete blobs that exist in the obj
      var populatedBlobs = [];

      if (this.options.blobFields && Array.isArray(this.options.blobFields)) this.options.blobFields.forEach(function (blobKey) {
        if (obj[blobKey]) populatedBlobs.push(blobKey);
      });

      if (populatedBlobs.length) return Promise.all(populatedBlobs.map(function (blobKey) {

        var imageRef = firebase.storage().ref().child(_this6.itemLocation(parentId, itemId) + '/' + blobKey + ".jpg");
        return imageRef.delete().then(function () {
          // File deleted successfully
        }).catch(function (e) {
          console.log(e);
        });
      }));else return Promise.resolve('No blob fields to delete');
    }
  }, {
    key: 'load',
    value: function load(parentId, callback) {
      var refLocation = this.parentLocation(parentId);
      //console.log('load() refLocation',refLocation);

      return firebase.database().ref(refLocation).on('value', function (snapshot) {
        if (typeof callback == 'function') callback(snapshot.val());
      });
    }
  }, {
    key: 'find',
    value: function find(parentId, query, callback) {
      var refLocation = this.parentLocation(parentId);
      var field = Object.keys(query)[0];
      var value = query[field];

      if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) != 'object') {
        return firebase.database().ref(refLocation).orderByChild(field).equalTo(value).on('value', function (snapshot) {
          if (typeof callback == 'function') callback(snapshot.val());
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

        return firebase.database().ref(refLocation).orderByChild(field).startAt(value.start).endAt(value.end).on('value', function (snapshot) {
          if (typeof callback == 'function') callback(snapshot.val());
        });
      }
    }
  }, {
    key: 'get',
    value: function get(parentId, itemId, callback) {
      //console.log('get(parentId, itemId, callback) params: ', parentId, itemId, callback)
      var refLocation = this.itemLocation(parentId, itemId);
      //console.log('get() refLocation',refLocation);

      return firebase.database().ref(refLocation).on('value', function (snapshot) {
        if (typeof callback == 'function') callback(snapshot.val());
      });
    }
  }]);

  return Model;
}();

exports.default = Model;