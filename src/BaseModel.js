import Model from './Model';

export default class BaseModel extends Model {
  
  constructor(modelName, options) {
      super('root', modelName, options);
  }
  
  parentLocation(parentId) {
    return this.modelName;
  }
  
  write(itemId, obj, blobs) { return super.write('root', itemId, obj, blobs) }
  
  patch(itemId, obj, blobs) { return super.patch('root', itemId, obj, blobs) }
    
  create(obj, blobs) { 
    if (typeof(obj) == 'object' && firebase.auth().currentUser) obj.members = [firebase.auth().currentUser.uid];    
    return super.create('root', obj, blobs) // update the user-referenced registry for this base model
      .then((groupId) => {
        var currentUid = firebase.auth().currentUser.uid;
        var updates = {};
        updates['users-' + this.modelName + '/' + currentUid + '/' + groupId ] = 'admin';      
        return firebase.database().ref().update(updates)      
      })
    ;
  };
  
  remove(itemId, obj) { 
    if (!obj || typeof(obj) !== 'object') return Promise.reject('Invalid input provided to BaseModel.remove() - obj required')
    else return super.remove('root', itemId, obj)
      .then((groupId) => { // remove the user-referenced registry entries for this base model
        var updates = {};
        if (obj.members) obj.members.forEach((userId) => {
          updates['/users-' + this.modelName + '/' + userId + '/' + itemId] = null;
        });
        return firebase.database().ref().update(updates)
      })
    ;  
  };
  
  get(itemId, callback) {
    
    return firebase.database().ref(this.modelName + '/' + itemId).on('value', (snapshot) => {
      if (typeof(callback) == 'function') callback( snapshot.val() );      
    });
    
  };
  
  load(callback) {
    var currentUser = firebase.auth().currentUser;
    
    if (!currentUser) return Promise.resolve('Not authenticated')  
    else {
      var groupIds = []
      var groups = {};
      
      return firebase.database().ref('/users-' + this.modelName +'/' + currentUser.uid).once('value')
        .then((snapshot) => {
          var userGroupIds = snapshot.val();
          //console.log('userGroupIds', userGroupIds);
          if (userGroupIds) Object.keys(userGroupIds).forEach((groupId) => {
            groupIds.push(groupId);
          });
        })
        .then(() => {
          var userEmailDomain = firebase.auth().currentUser.email.replace(/^[^@]+/,'');
          return firebase.database().ref('wildcards-accounts').child(userEmailDomain.replace(/\./g, '%2E')).once('value')
            .then((snapshot) => {              
              var wildcardGroupIds = snapshot.val();
              //console.log('wildcardGroupIds', wildcardGroupIds);
              if (wildcardGroupIds) Object.keys(wildcardGroupIds).forEach((groupId) => {
                groupIds.push(groupId);
              });
              
            })
        })
        .then(() => {
          if (!groupIds || !groupIds.length) return Promise.resolve('No user accounts');
          else return Promise.all(
            groupIds.map((groupId) => {
              return firebase.database().ref(this.modelName + '/' + groupId).once('value').then((snapshot) => {
                var group = snapshot.val();
                if (group) groups[groupId] = group;              
              })        
            })
          )
          
        })
        .then(function() {
          if (typeof(callback) == 'function') callback(groups);      
        })
        .catch((err) => {
          console.log("error in load() ", err);
        })
        
              
    }
  }
  
  find(query, callback)  { return super.find('root', query, callback) };
  
}


