# super cool webring service

I'd host it myself if I had a nodejs server, but alas. If you want to host it here are the simple (?) steps.

1. Create a firebase account and a new app, call it whatever, then click the little build dropdown and press "Realtime Database", then click create database, just start in locked mode it doesn't really matter.

2. In your database, go to the "rules" tab, in there replace the current rules with this: 

```
{
  "rules": {
    ".read": false,
    ".write": true,
    "users": {
      ".indexOn": ["id", "name"]
    }
  }
}
```

3. Now, click the cog beside "Project Overview". Click "Project settings", then go to the "Service accounts" tab. In there click "Generate new private key", that should download a file with a long ass name. Rename that file "serviceAccountKey.json" and put it in the root of this project.

4. Inside serviceAccountKey.json add a line, call it "database_url" like so:

```
"database_url": "YOUR_DATABASE_URL"
```

to get your database URL go back into your firebase project, click "Realtime Database" and copy the reference url in the data tap. It should look something like this: https://webs-394fa-default-rtdb.firebaseio.com/.

5. Run the program with 

```
node server.js
```