'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _Model2 = require('./Model');

var _Model3 = _interopRequireDefault(_Model2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var UserModel = function (_Model) {
  _inherits(UserModel, _Model);

  function UserModel(modelName, options) {
    _classCallCheck(this, UserModel);

    return _possibleConstructorReturn(this, (UserModel.__proto__ || Object.getPrototypeOf(UserModel)).call(this, 'users', modelName, options));
  }

  _createClass(UserModel, [{
    key: 'currentUid',
    value: function currentUid() {
      return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null;
    }
  }, {
    key: 'parentLocation',
    value: function parentLocation(parentId) {
      if (this.isNested()) return 'users-' + this.parentModelName + '/' + parentId + '/' + this.modelName;else return 'users-' + this.modelName + '/' + this.currentUid();
    }
  }, {
    key: 'write',
    value: function write(itemId, obj, blobs) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'write', this).call(this, this.currentUid(), itemId, obj, blobs);
    }
  }, {
    key: 'patch',
    value: function patch(itemId, obj, blobs) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'patch', this).call(this, this.currentUid(), itemId, obj, blobs);
    }
  }, {
    key: 'create',
    value: function create(obj, blobs) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'create', this).call(this, this.currentUid(), obj, blobs);
    }
  }, {
    key: 'remove',
    value: function remove(itemId) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'remove', this).call(this, this.currentUid(), itemId);
    }
  }, {
    key: 'get',
    value: function get(itemId, callback) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'get', this).call(this, this.currentUid(), itemId, callback);
    }
  }, {
    key: 'load',
    value: function load(callback) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'load', this).call(this, this.currentUid(), callback);
    }
  }, {
    key: 'find',
    value: function find(query, callback) {
      return _get(UserModel.prototype.__proto__ || Object.getPrototypeOf(UserModel.prototype), 'find', this).call(this, this.currentUid(), query, callback);
    }
  }]);

  return UserModel;
}(_Model3.default);

exports.default = UserModel;