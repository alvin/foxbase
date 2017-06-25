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
//import slugify from 'underscore.string';

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
      if (this.parentModelName == 'root' || parentId == 'root') return this.parentModelName + '-' + this.modelName;
      if (this.isNested()) return this.parentModelName + '/' + parentId + '/' + this.modelName;else return this.parentModelName + '-' + this.modelName + '/' + parentId;
    }
  }, {
    key: 'itemLocation',
    value: function itemLocation(parentId, itemId) {
      return this.parentLocation(parentId) + '/' + itemId;
    }
  }, {
    key: 'resolveForeignPath',
    value: function resolveForeignPath(parentId, itemId, field, fieldValue) {
      var parentPath = (parentId ? parentId : '') + '/';
      if (typeof parentId == 'undefined' || parentId == 'root') parentPath = '';
      return field + '-' + this.modelName + '/' + parentPath + fieldValue + '/' + itemId;
    }
  }, {
    key: 'isNested',
    value: function isNested() {
      return _typeof(this.options) == "object" && this.options.nested;
    }
  }, {
    key: 'getForeignRefUpdates',
    value: function getForeignRefUpdates(parentId, itemId, obj) {
      var _this = this;

      var refUpdates = {};

      if (this.options.foreignIdRefs) this.options.foreignIdRefs.forEach(function (field) {
        if (obj && (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) == 'object' && typeof obj[field] != 'undefined') {
          if (obj[field] && obj[field].length) obj[field].forEach(function (value, idx) {
            refUpdates[_this.resolveForeignPath(parentId, itemId, field, value)] = true;
          });
        }
      });
      return refUpdates;
    }
  }, {
    key: 'preprocessForeignRefs',
    value: function preprocessForeignRefs(parentId, itemId, obj) {
      var _this2 = this;

      if (!this.options.foreignIdRefs) return Promise.resolve(obj);else {
        return firebase.database().ref(this.itemLocation(parentId, itemId)).once('value').then(function (snapshot) {

          var item = snapshot.val();
          var removeRefs = {};

          if (item) {

            _this2.options.foreignIdRefs.forEach(function (field) {
              if (item && (typeof item === 'undefined' ? 'undefined' : _typeof(item)) == 'object' && typeof item[field] != 'undefined') {
                if (item[field] && item[field].length) item[field].forEach(function (value, idx) {
                  if (typeof obj[field] != 'undefined' && !obj[field] || !obj[field].includes(value)) {
                    // the old value is gone or isn't in the new array, delete the foreign ref!
                    removeRefs[_this2.resolveForeignPath(parentId, itemId, field, value)] = null;
                  }
                });
              }
            });
          }

          return firebase.database().ref().update(removeRefs);
        }).catch(function (e) {
          console.log(e);
        });
      }
    }
  }, {
    key: 'write',
    value: function write(parentId, itemId, obj, blobs) {
      var _this3 = this;

      //console.log('write() input: ', parentId, itemId, obj, blobs);

      if (!parentId || !itemId || typeof parentId != 'string' || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) != 'object' && typeof obj != 'null' && typeof obj != 'string' && typeof obj != 'boolean' || typeof itemId != 'string') {
        return Promise.reject('Invalid input provided to write()');
      } else {

        return this.preprocessForeignRefs(parentId, itemId, obj).then(function () {
          return firebase.database().ref(_this3.itemLocation(parentId, itemId)).set(obj);
        }).then(function () {
          return firebase.database().ref().update(_this3.getForeignRefUpdates(parentId, itemId, obj));
        }).then(function () {
          return _this3.uploadBlobs(parentId, itemId, obj, blobs);
        }).catch(function (e) {
          console.log(e);
        });
      }
    }
  }, {
    key: 'patch',
    value: function patch(parentId, itemId, obj, blobs) {
      var _this4 = this;

      //console.log('parentid ' + parentId, 'itemId ' + itemId, 'obj ' + obj, 'blobs ' + blobs);

      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object' || !parentId || typeof parentId !== 'string' || !itemId || typeof itemId !== 'string') return Promise.reject('Invalid input provided to patch()');else {
        var updates = {};
        Object.keys(obj).forEach(function (key) {
          updates[_this4.itemLocation(parentId, itemId) + '/' + key] = obj[key];
        });

        updates = Object.assign(updates, this.getForeignRefUpdates(parentId, itemId, obj));

        //console.log('updates', updates);
        return this.preprocessForeignRefs(parentId, itemId, obj).then(function () {
          return firebase.database().ref().update(updates);
        }).then(function () {
          if (blobs) return _this4.uploadBlobs(parentId, itemId, obj, blobs);else return obj;
        });
      }
    }
  }, {
    key: 'create',
    value: function create(parentId, obj, blobs) {
      var newId = obj.id || firebase.database().ref().child(this.parentLocation(parentId)).push().key;
      if (typeof obj.id == 'string' && !this.options.keepIdProp) {
        if (_.size(obj) == 1) obj = true;else delete obj.id;
      }
      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) == "object") {
        if (_typeof(this.options) == 'object') {
          if (this.options.createdAt) obj.createdAt = firebase.database.ServerValue.TIMESTAMP;
          if (this.options.createdById) obj.createdById = firebase.auth().currentUser.uid;
          if (this.options.createdByEmail) obj.createdByEmail = firebase.auth().currentUser.email;
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
    value: function remove(parentId, itemId, updates) {
      var _this5 = this;

      if (!parentId || typeof parentId !== 'string' || !itemId || typeof itemId !== 'string') return Promise.reject('Invalid input provided to remove()');else {
        if ((typeof updates === 'undefined' ? 'undefined' : _typeof(updates)) != 'object') updates = {};

        var blobRefs = [];
        var childRefs = {};

        if (this.options.rootChildren) this.options.rootChildren.forEach(function (childModelName) {

          var childModel = models[childModelName];
          var childRef = childModel.itemLocation(parentId, itemId);
          childRefs[childModelName] = childRef;
          updates[childRef] = null;
        });

        return firebase.database().ref(this.itemLocation(parentId, itemId)).once('value').then(function (snapshot) {
          var item = snapshot.val();
          return item;
        }).then(function (item) {
          if (_this5.options.foreignIdRefs) _this5.options.foreignIdRefs.forEach(function (field) {
            if (typeof field == "string" && item && item[field]) {
              if (item && item[field].length) item[field].forEach(function (fieldValue, idx) {
                var foreignPath = _this5.resolveForeignPath(parentId, itemId, field, fieldValue);
                updates[foreignPath] = null;
              });
            }
          });
          return item;
        }).then(function (item) {
          // comb thru existing object looking for blobs
          if (item && _this5.options.blobFields && Array.isArray(_this5.options.blobFields)) _this5.options.blobFields.forEach(function (blobKey) {
            if (item[blobKey]) blobRefs.push(_this5.itemLocation(parentId, itemId) + '/' + blobKey);
          });
        }).then(function () {
          // comb thru all child items looking for populated blob values
          // add said locations to blobRefs[] for deletion below post update()
          return Promise.all(_.map(Object.keys(childRefs).forEach(function (modelName) {
            var ref = childRefs[modelName];
            var model = models[modelName];

            return firebase.database().ref(ref).once('value').then(function (snapshot) {
              var itemIds = [];
              var items = snapshot.val();

              if (items) Object.keys(items).forEach(function (itemId) {
                if (model.options.blobFields && Array.isArray(model.options.blobFields)) model.options.blobFields.forEach(function (blobKey) {
                  var item = items[itemId];
                  if (item[blobKey]) blobRefs.push(ref + '/' + itemId + '/' + blobKey);
                });
              });
            });
          })));
        }).then(function () {

          updates[_this5.itemLocation(parentId, itemId)] = null;
          return firebase.database().ref().update(updates).then(function () {
            return Promise.all(_.map(blobRefs, function (blobRef) {
              return firebase.storage().ref().child(blobRef).delete().then(function () {
                //console.log(blobRef + " deleted.")
                // File deleted successfully
              }).catch(function (e) {
                console.log(e);
              });
            }));
          });
        });
      }
    }
  }, {
    key: 'uploadBlobs',
    value: function uploadBlobs(parentId, itemId, obj, blobs) {
      var _this6 = this;

      if (blobs && (typeof blobs === 'undefined' ? 'undefined' : _typeof(blobs)) == "object") return Promise.all(Object.keys(blobs).map(function (blobKey) {
        var blob = blobs[blobKey];

        var imageRef = firebase.storage().ref().child(_this6.itemLocation(parentId, itemId) + '/' + blobKey);
        //{contentType: 'image/jpeg'}
        return imageRef.put(blob, {}).then(function (result) {
          var addImageUpdate = {};
          obj[blobKey] = result.downloadURL;
          addImageUpdate[_this6.itemLocation(parentId, itemId) + '/' + blobKey] = result.downloadURL;
          return firebase.database().ref().update(addImageUpdate).then(function () {
            return obj;
          });
        }).catch(function (e) {
          console.log(e);
        });
      }));else return Promise.resolve(obj);
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