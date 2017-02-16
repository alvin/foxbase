'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _Model2 = require('./Model');

var _Model3 = _interopRequireDefault(_Model2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BaseModel = function (_Model) {
  _inherits(BaseModel, _Model);

  function BaseModel(modelName, options) {
    _classCallCheck(this, BaseModel);

    return _possibleConstructorReturn(this, (BaseModel.__proto__ || Object.getPrototypeOf(BaseModel)).call(this, 'root', modelName, options));
  }

  _createClass(BaseModel, [{
    key: 'parentLocation',
    value: function parentLocation(parentId) {
      return this.modelName;
    }
  }, {
    key: 'write',
    value: function write(itemId, obj, blobs) {
      return _get(BaseModel.prototype.__proto__ || Object.getPrototypeOf(BaseModel.prototype), 'write', this).call(this, 'root', itemId, obj, blobs);
    }
  }, {
    key: 'patch',
    value: function patch(itemId, obj, blobs) {
      return _get(BaseModel.prototype.__proto__ || Object.getPrototypeOf(BaseModel.prototype), 'patch', this).call(this, 'root', itemId, obj, blobs);
    }
  }, {
    key: 'create',
    value: function create(obj, blobs) {
      var _this2 = this;

      if ((typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) == 'object' && firebase.auth().currentUser) obj.members = [firebase.auth().currentUser.uid];
      return _get(BaseModel.prototype.__proto__ || Object.getPrototypeOf(BaseModel.prototype), 'create', this).call(this, 'root', obj, blobs) // update the user-referenced registry for this base model
      .then(function (groupId) {
        var currentUid = firebase.auth().currentUser.uid;
        var updates = {};
        updates['users-' + _this2.modelName + '/' + currentUid + '/' + groupId] = 'admin';
        return firebase.database().ref().update(updates);
      });
    }
  }, {
    key: 'remove',
    value: function remove(itemId, obj) {
      var _this3 = this;

      if (!obj || (typeof obj === 'undefined' ? 'undefined' : _typeof(obj)) !== 'object') return Promise.reject('Invalid input provided to BaseModel.remove() - obj required');else return _get(BaseModel.prototype.__proto__ || Object.getPrototypeOf(BaseModel.prototype), 'remove', this).call(this, 'root', itemId, obj).then(function (groupId) {
        // remove the user-referenced registry entries for this base model
        var updates = {};
        if (obj.members) obj.members.forEach(function (userId) {
          updates['/users-' + _this3.modelName + '/' + userId + '/' + itemId] = null;
        });
        return firebase.database().ref().update(updates);
      });
    }
  }, {
    key: 'get',
    value: function get(itemId, callback) {

      return firebase.database().ref(this.modelName + '/' + itemId).on('value', function (snapshot) {
        if (typeof callback == 'function') callback(snapshot.val());
      });
    }
  }, {
    key: 'load',
    value: function load(callback) {
      var _this4 = this;

      var currentUser = firebase.auth().currentUser;

      if (!currentUser) return Promise.resolve('Not authenticated');else {
        var groupIds = [];
        var groups = {};

        return firebase.database().ref('/users-' + this.modelName + '/' + currentUser.uid).once('value').then(function (snapshot) {
          var userGroupIds = snapshot.val();
          //console.log('userGroupIds', userGroupIds);
          if (userGroupIds) Object.keys(userGroupIds).forEach(function (groupId) {
            groupIds.push(groupId);
          });
        }).then(function () {
          var userEmailDomain = firebase.auth().currentUser.email.replace(/^[^@]+/, '');
          return firebase.database().ref('wildcards-accounts').child(userEmailDomain.replace(/\./g, '%2E')).once('value').then(function (snapshot) {
            var wildcardGroupIds = snapshot.val();
            //console.log('wildcardGroupIds', wildcardGroupIds);
            if (wildcardGroupIds) Object.keys(wildcardGroupIds).forEach(function (groupId) {
              groupIds.push(groupId);
            });
          });
        }).then(function () {
          if (!groupIds || !groupIds.length) return Promise.resolve('No user accounts');else return Promise.all(groupIds.map(function (groupId) {
            return firebase.database().ref(_this4.modelName + '/' + groupId).once('value').then(function (snapshot) {
              var group = snapshot.val();
              if (group) groups[groupId] = group;
            });
          }));
        }).then(function () {
          if (typeof callback == 'function') callback(groups);
        }).catch(function (err) {
          console.log("error in load() ", err);
        });
      }
    }
  }, {
    key: 'find',
    value: function find(query, callback) {
      return _get(BaseModel.prototype.__proto__ || Object.getPrototypeOf(BaseModel.prototype), 'find', this).call(this, 'root', query, callback);
    }
  }]);

  return BaseModel;
}(_Model3.default);

exports.default = BaseModel;