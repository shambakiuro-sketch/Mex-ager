# Jackson Messaging App

A real-time messaging application built with React, Next.js, and Firebase.

## Features

✅ **Real-time Messaging** - Messages appear instantly
✅ **File Sharing** - Upload and share files/images
✅ **User Authentication** - Secure login/register
✅ **User List** - See all available users
✅ **1-to-1 Chat** - Private conversations
✅ **Message Timestamps** - Know when messages were sent
✅ **File Downloads** - Easy file sharing

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Firebase account (free)

## Setup Instructions

### Step 1: Clone or Extract Project

```bash
cd jackson-messaging-app
```

### Step 2: Install Dependencies

```bash
npm install
```

### Step 3: Firebase Setup

The Firebase config is already added to `app/lib/firebase.js` with:
- Project: jackson-messaging-app
- Database: Realtime Database
- Storage: Cloud Storage

**You don't need to create another Firebase project - it's already set up!**

### Step 4: Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## How to Use

### 1. First Time Setup

1. **Create account** - Register with email and password
2. **Set display name** - This is shown to other users
3. **You're ready!**

### 2. Sending Messages

1. Click on a user in the sidebar
2. Type your message
3. Click "Send" or press Enter
4. Messages appear instantly

### 3. Sharing Files

1. Click the **📎** button in the chat window
2. Select file from your device
3. File is uploaded and shared
4. Other user can download it

### 4. Multiple Users

- Up to 10 users can register
- Each pair can have private conversations
- All conversations are encrypted by Firebase

## File Structure

```
jackson-messaging-app/
├── app/
│   ├── components/
│   │   ├── Auth.js              # Login/Register
│   │   ├── Chat.js              # Main chat interface
│   │   ├── UserList.js          # User list sidebar
│   │   └── ChatWindow.js        # Message display & input
│   ├── lib/
│   │   └── firebase.js          # Firebase configuration
│   ├── layout.js                # Root layout
│   └── page.js                  # Main page
├── package.json
├── next.config.js
└── README.md
```

## Authentication

- **Login** - Use existing email/password
- **Register** - Create new account with display name
- **Secure** - Passwords encrypted by Firebase

## Real-time Database Structure

```
jackson-messaging-app/
├── users/
│   ├── {uid}/
│   │   ├── displayName
│   │   ├── email
│   │   └── lastSeen
│
├── chats/
│   ├── {uid1_uid2}/
│   │   └── messages/
│   │       ├── message1
│   │       ├── message2
│   │       └── ...
```

## Deployment to Vercel

1. Push to GitHub
2. Go to vercel.com
3. Import repository
4. Click "Deploy"

That's it! Your app is live.

## Limits & Quotas (Free Firebase Tier)

- **Database**: 1GB storage
- **Storage**: 5GB for files
- **Concurrent Connections**: 100
- **For 2-10 users**: Completely FREE

## Troubleshooting

### Messages not appearing?
- Check Firebase Realtime Database is enabled
- Verify rules: Database should have read/write access

### Can't upload files?
- Check Firebase Storage bucket exists
- Verify rules: Allow read/write

### Login issues?
- Check email/password are correct
- Verify Firebase Authentication is enabled

## Security Notes

- Never share your Firebase config with untrusted users
- Database rules are set to allow authenticated users only
- Files are stored with unique names to prevent conflicts

## Adding More Users

1. New user registers with their email
2. They appear in all other users' lists
3. Everyone can start 1-to-1 chats

## Future Enhancements

- Group chats
- Voice messages
- Video calls
- User profiles
- Message search
- Read receipts

## Support

For issues or questions, check:
- Firebase documentation: https://firebase.google.com/docs
- Next.js documentation: https://nextjs.org/docs

## License

© 2024 Jackson Messaging App
