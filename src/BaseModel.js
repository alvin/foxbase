import Model from './Model';

export default class BaseModel extends Model {
  
  constructor(modelName, options) {
      super('root', modelName, options);
  }
  
  parentLocation(parentId) {  return this.modelName; }
  
  itemLocation(itemId) { return `${this.modelName}/${itemId}`; };  
  
  write(itemId, obj, blobs) { 
    return super.write('root', itemId, obj, blobs) 
  }
  
  patch(itemId, obj, blobs) { 
    return super.patch('root', itemId, obj, blobs) 
  }
    
  create(obj, blobs) { 
    if (typeof(obj) == 'object' && firebase.auth().currentUser && !obj.members) { 
      var currentEmailRef = firebase.auth().currentUser.email.replace(/\./g, '%2E');
      obj.members = {};      
      obj.members[currentEmailRef] = 'admin';
    }
    return super.create('root', obj, blobs) // update the user-referenced registry for this base model
      .then((groupId) => {
        var currentUid = firebase.auth().currentUser.uid;
        var currentEmailRef = firebase.auth().currentUser.email.replace(/\./g, '%2E');
        var updates = {};
        updates['emails-' + this.modelName + '/' + currentEmailRef + '/' + groupId ] = 'admin';      
        return firebase.database().ref().update(updates)      
      })
    ;
  };
  
  remove(itemId, updates) { 
    var updates = {};
    return firebase.database().ref(this.itemLocation(itemId)).once('value')
      .then((snapshot) => {
        var item = snapshot.val();
        if (item) Object.keys(item.members).forEach((email) => {
          updates[`emails-${this.modelName}/${email}/${itemId}`] = null;            
        })
      })
      .then(() => {
        // look up external related things (not including )
        return firebase.database().ref(`${this.modelName}-wildcards/${itemId}`).once('value')
          .catch((err) => { 
            // its okay to have no result here}
          })
          .then((snapshot) => {
            var domain = snapshot.val();
            if (domain) updates[`wildcards-${this.modelName}/${domain.replace(/\./g,'%2E')}/${itemId}`] = null;
          })
      })
      .then(() => {
        console.log('pre-updates', updates);
        return super.remove('root', itemId, updates)          
        
      })
    
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

      var currentEmailRef = firebase.auth().currentUser.email.replace(/\./g, '%2E');
      return firebase.database().ref(`emails-${this.modelName}`).child(currentEmailRef).once('value')
        .then((snapshot) => {              
          var emailGroupIds = snapshot.val();
          //console.log('wildcardGroupIds', wildcardGroupIds);
          if (emailGroupIds) Object.keys(emailGroupIds).forEach((groupId) => {
            groupIds.push(groupId);
          });
        })
        .then(() => {
          var userEmailDomain = firebase.auth().currentUser.email.replace(/^[^@]+/,'');
          return firebase.database().ref(`wildcards-${this.modelName}`).child(userEmailDomain.replace(/\./g, '%2E')).once('value')
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
        .catch((err) => {
          console.log("error in load() ", err);
          return true
        })
        .then(function() {
          if (typeof(callback) == 'function') callback(groups);      
        })
        
              
    }
  }
  
  find(query, callback)  { return super.find('root', query, callback) };
  
}


