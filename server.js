const express = require('express');
const app = express();
const port = 5501; // best port btw
const expressLayouts = require('express-ejs-layouts'); // so you can do layouts like with 11ty and stuff yk
const db = require('./firebase');
const bcrypt = require('bcrypt');

app.use(expressLayouts); // enabling shit and making express recognize /public
app.use(express.static('public'));
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.render("home", { title: 'Home' });
});

app.get('/signup', (req, res) => {
  res.render("signup", { title: 'Sign up', error: null }); // initializing the default values and pushing them to the edit page
});

app.get('/edit', (req, res) => {
  res.render("edit", { title: 'Edit Members', user: null, error: null });
});

app.get('/success', (req, res) => {
  res.render("success", { title: 'Success!' });
});

// directory of users
app.get('/directory', async (req, res) => {
  try {
    const snapshot = await db.ref('users').get();
    const users = snapshot.exists() ? snapshot.val() : null; // sexy if statement that checks if snapshot has anything, if it does it extracts it, if not it sets it to a null. is this needed?? idk. i think it was at some point.
    res.render('directory', {
      title: 'Directory',
      users: users || {},
      error: null
    }); // passes users over and has it as an empty object by default.
  } catch (error) {
    res.status(500).render('error', {
      errorCode: 500,
      errorMessage: "Error fetching rings",
      title: "500"
    });
  }
});

// add a new user
app.post('/add-user', async (req, res) => {
  try {
    const { name, url, desc, pass, memberUrls, autoAccept } = req.body;
    const autoAcceptBoolean = autoAccept === 'on'; // converting the checkbox on and off to boolean. if its on it will be true.

    const usersRef = db.ref('users');
    const existingUserSnapshot = await usersRef.orderByChild('name').equalTo(name).once('value'); // checks the user node to see if a name is equal to what was inputted, then if it does existingUserSnapshot becomes a long ass tree of stuff. doesnt matter though its just happening so it can be checked in the next line.
    if (existingUserSnapshot.exists()) {
      return res.render("signup", {
        title: 'Sign Up',
        error: "Name already taken!"
      });
    }

    const countRef = db.ref('count'); // points to my user count node, used for giving the users number ids
    const countSnapshot = await countRef.get();
    let userCount = countSnapshot.exists() ? countSnapshot.val() : 0;
    userCount += 1;

    const saltRounds = 10; // Adjust as needed for security and performance
    const hashedPassword = await bcrypt.hash(pass, saltRounds);

    const newUserRef = db.ref('users').push(); // creating a new entry under users
    await newUserRef.set({
      id: userCount, // set their id as the newly incremented id
      name,
      url,
      desc,
      pass: hashedPassword, // Store the hashed password
      member: memberUrls ? memberUrls.split(',').map(url => url.trim()) : [], // splitting the members into an array
      autoAccept: autoAcceptBoolean // Use the boolean value here
    });

    await countRef.set(userCount); // new user count set
    return res.redirect('/success');
  } catch (error) {
    return res.render("signup", {
      title: 'Sign Up',
      error: "There was a mystery error while signing up!"
    });
    }
});

// making pages generate for every webring. yes i can see how using user, directory and webring interchangeably is confusing i just couldnt last night
app.get('/directory/:id', async (req, res) => {
  try {
    const userId = req.params.id; // captures the id value from the url
    const pageUrl = req.get('host'); // getting the url of this page (for the embed links)
    const usersSnapshot = await db.ref('users').orderByChild('id').equalTo(parseInt(userId)).get(); // queries the database for an entry where in users an id matches userId which has been converted to an integer.
    if (!usersSnapshot.exists()) {
      return res.render('directory', {
        title: 'Directory',
        users: null,
        error: "Ring not found!"
      });
    }

    const user = Object.values(usersSnapshot.val())[0]; // 0 because its assuming only one thing has the id of the page (if this breaks there are probably bigger problems).
    const { name, url, desc, member, autoAccept } = user; // this is some object destructuring (big words i know), its just setting the variables in each spot of the array "user". like at index 0 there is name, index 1 there is user etc.
    const memberUrls = member || []; // stores the member array if it exists, if it doesnt its an empty array
    res.render('user', { // passing all these things to the user ejs template so i can use them.
      title: `${name}`,
      user,
      name,
      url,
      desc,
      pageUrl,
      memberUrls,
      autoAccept
    });
  } catch (error) {
    res.render('directory', {
      title: 'Directory',
      users: null,
      error: "Ruh roh, something went wrong."
    });
  }
});

// almost the same as the directory code, everything is pretty self explanatory
app.get('/directory/:id/random', async (req, res) => {
  try {
    const userId = req.params.id;
    const usersSnapshot = await db.ref('users').orderByChild('id').equalTo(parseInt(userId)).get();
    if (!usersSnapshot.exists()) {
      return res.render('directory', {
        title: 'Directory',
        users: null,
        error: "This webring doesn't exist!"
      });
    }

    const user = Object.values(usersSnapshot.val())[0];
    const memberUrls = user.member || [];

    if (memberUrls.length === 0) {
      return res.render('directory', {
        title: 'Directory',
        users: null,
        error: "There are no members in this webring!"
      });
    }

    const randomUrl = memberUrls[Math.floor(Math.random() * memberUrls.length)];
    return res.redirect(randomUrl);

  } catch (error) {
    return res.render('directory', {
      title: 'Directory',
      users: null,
      error: "Error fetching the members url."
    });
  }
});

// handle login form submission and fetch user data by name
app.post('/edit', async (req, res) => {
  try {
    const { name, pass } = req.body;

    const usersSnapshot = await db.ref('users').orderByChild('name').equalTo(name).get(); // query firebase for the name and grabs the little random string of characters firebase gives you, looks like this: -OBFYovENofv6JmdXHM6
    if (!usersSnapshot.exists()) {
      return res.render("edit", {
        title: 'Edit User',
        user: null,
        error: "Incorrect name"
      }); // making sure user exists
    }

    const user = Object.values(usersSnapshot.val())[0]; // idk i stole this enums confuse me
    const isMatch = await bcrypt.compare(pass, user.pass);

    if (!isMatch) {
      return res.render("edit", {
        title: 'Edit User',
        user: null,
        error: "Incorrect password"
      });
    }

    return res.render("edit", {
      title: 'Edit User',
      user,
      error: null
    }); // renders edit.ejs as long as their arent any errors
  } catch (error) {
      return res.render("edit", {
        title: 'Edit User',
        user: null,
        error: "Mystery error while fetching the user!"
      });
  }
});

// handle updating the homepage url for the webring admin
app.post(['/edit-members', '/edit-url'], async (req, res) => {
  try {
    const { name, memberUrls, url } = req.body;
    const usersSnapshot = await db.ref('users').orderByChild('name').equalTo(name).get();

    if (!usersSnapshot.exists()) {
      return res.render("edit", {
        title: 'Edit User',
        user: null,
        error: "Your webring is somehow in a limbo state of existing and not existing."
      });
    }

    const userKey = Object.keys(usersSnapshot.val())[0];
    const updateData = memberUrls ? { member: memberUrls.split(',').map(url => url.trim()) } : { url };

    await db.ref(`users/${userKey}`).update(updateData);
    return res.redirect('/directory');
  } catch (error) {
    return res.render("edit", {
      title: 'Edit User',
      user: null,
      error: `Mystery error while updating ${memberUrls ? 'members' : 'URL'}!`
    });
  }
});

app.post('/user-site-upload', async (req, res) => {
  try {
    const { id, url } = req.body;

    if (!url || !id) {
      return res.render("edit", {
        title: 'Add Member URL',
        user: null,
        error: 'How did you get here?' // theoretically this error should never happen to a user
      });
    }

    const usersRef = db.ref('users');
    const usersSnapshot = await usersRef.orderByChild('id').equalTo(parseInt(id)).get();

    if (!usersSnapshot.exists()) {
      return res.render("directory", {
        title: 'Directory',
        users: null,
        error: 'This webring has gone missing.' // same with this error
      });
    }

    const userKey = Object.keys(usersSnapshot.val())[0]; // converting snapshot into array and grabbing the first key
    const userData = usersSnapshot.val()[userKey]; // usersSnapshot.val() contains all matching users and userKey grabs the data specific to the user we just found

    const updatedMemberUrls = Array.isArray(userData.member) ? [...userData.member, url.trim()] : [url.trim()]; // checks if the member field is an array. this should never matter (i think) but just in case. if it isnt it creates a new array containing only the trimmed url. if its true it uses the very ugly spread operator to expand my array out so i can add the new value right at the end.

    await usersRef.child(userKey).update({ member: updatedMemberUrls });

    return res.redirect(`/directory/${id}`);
  } catch (error) {
    console.error("Error updating member URLs:", error);
    return res.render("directory", {
      title: 'Directory',
      users: null,
      error: 'Error adding member.'
    });
  }
});

// helper function to navigate to previous or next member url. stole this almost verbatim from somewhere. was getting late.
async function navigateToAdjacentMember(req, res, direction) {
  try {
    const userId = req.params.id;
    const currentUrl = req.query.via;

    const usersSnapshot = await db.ref('users').orderByChild('id').equalTo(parseInt(userId)).get();
    if (!usersSnapshot.exists()) {
      return res.render('directory', {
        title: 'Directory',
        users: {},
        error: "This webring doesn't exist!"
      });
    }

    const user = Object.values(usersSnapshot.val())[0];
    const memberUrls = user.member || [];

    const currentIndex = memberUrls.indexOf(currentUrl);
    if (currentIndex === -1) {
      return res.render('directory', {
        title: 'Directory',
        users: {},
        error: "This URL was not found in member list"
      });
    }

    const newIndex = (currentIndex + direction + memberUrls.length) % memberUrls.length;
    const newUrl = memberUrls[newIndex];

    return res.redirect(newUrl);
  } catch (error) {
    return res.render('directory', {
      title: 'Directory',
      users: {},
      error: "Error navigating members"
    });
  }
}

// routes for previous and next member urls
app.get('/directory/:id/prev', (req, res) => navigateToAdjacentMember(req, res, -1));
app.get('/directory/:id/next', (req, res) => navigateToAdjacentMember(req, res, 1));

app.use(function(req, res) {
  res.status(404);
  res.render("404", {
    title: '404!'
  });
});

app.listen(port, () => {
  console.log(`App listening on port http://localhost:${port}/`)
})