# foxbase
A lightweight model/lifecycle library for Google's Firebase.  Includes models scoped to a current user, child relationships, and blob associations (i.e. for images/attachements)

#notes
- very much a work-in-progress, all is subject to change!
- bring your own validator (i.e. JSON Schema or whatever comes packaged with your UI library)

# usage

```
npm install foxbase
```

```
import Foxbase from 'foxbase';
```

```
module.exports = new Foxbase.UserModel('contacts', {
  rootChildren: ['connections'],
  blobFields: ['headshot']
});

module.exports = new Foxbase.UserModel('connections', {
  createdAt: true,
  rootChildren: [],
  blobFields: [] 
});
```

# license
MIT License.

# contributing
Let's chat!
