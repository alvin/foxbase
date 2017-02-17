import Model from './Model';

export default class UserModel extends Model {
  
  constructor(modelName, options) { super('users', modelName, options) }
  
  currentUid() { return firebase.auth().currentUser ? firebase.auth().currentUser.uid : null }

  parentLocation(parentId) { 
    if (this.isNested()) return `users-${this.parentModelName}/${parentId}/${this.modelName}`;
    else return `users-${this.modelName}/${this.currentUid()}`;      
  }  
  
  write(itemId, obj, blobs) { return super.write(this.currentUid(), itemId, obj, blobs) }
  
  patch(itemId, obj, blobs) { return super.patch(this.currentUid(), itemId, obj, blobs) }
  
  create(obj, blobs) { return super.create(this.currentUid(), obj, blobs) }
  
  remove(itemId) { return super.remove(this.currentUid(), itemId) }
  
  get(itemId, callback) { return super.get(this.currentUid(), itemId, callback) }
  
  load(callback) { return super.load(this.currentUid(), callback) }
  
  find(query, callback) { return super.find(this.currentUid(), query, callback) }
  
}