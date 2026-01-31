# Testing P2P Networking Locally

## Quick Start

### Option 1: Two Browser Tabs (Same Machine)
This is the easiest way to test the P2P connection flow:

1. **Start the dev server:**
   ```bash
   npm run dev
   ```

2. **Open two browser tabs:**
   - Tab 1 (Host): Navigate to `http://localhost:5173`
   - Tab 2 (Guest): Navigate to `http://localhost:5173`

3. **Set up the connection:**
   - **In Tab 1 (Host):**
     - Click "Host Game"
     - Note the peer ID displayed (e.g., `royal-a1b2`)
     - Keep this tab open
   
   - **In Tab 2 (Guest):**
     - Click "Join Game"
     - Since camera won't work in browser, click "Enter code manually"
     - Type the peer ID from Tab 1
     - Click "Connect"

4. **Verify connection:**
   - Tab 1 should show "Guest Player" in the players list
   - Tab 2 should show "Connected successfully!"
   - Both tabs should show green connection indicator in top-right

### Option 2: Two Devices on Same Network
For testing with QR code scanning:

1. **Start dev server with network access:**
   ```bash
   npm run dev -- --host
   ```
   Note the Network URL (e.g., `http://192.168.1.100:5173`)

2. **On Host Device (e.g., laptop):**
   - Navigate to the Network URL
   - Click "Host Game"
   - QR code will be displayed

3. **On Guest Device (e.g., phone):**
   - Navigate to the same Network URL
   - Click "Join Game"
   - Grant camera permission
   - Scan the QR code from host device
   - Connection should establish automatically

### Option 3: Build and Test Production Bundle

1. **Build the project:**
   ```bash
   npm run build
   ```

2. **Preview the production build:**
   ```bash
   npm run preview -- --host
   ```

3. Follow the same steps as Option 1 or 2

## What to Test

### Connection Flow
- [ ] Host creates game with unique peer ID
- [ ] Guest can scan QR code (on mobile)
- [ ] Guest can manually enter peer ID
- [ ] Connection status indicator updates correctly
- [ ] "Back" buttons properly disconnect and return to lobby

### Error Handling
- [ ] Invalid peer ID shows appropriate error
- [ ] Camera permission denied shows manual input
- [ ] Connection timeout handled gracefully
- [ ] Disconnection shows reconnection UI

### UI/UX
- [ ] QR code displays clearly
- [ ] Peer ID is readable and copyable
- [ ] Connection status indicator shows correct state
- [ ] "Start Game" button enables when guest joins

## Troubleshooting

### Blank/white screen when loading
If you see a blank screen when navigating to http://localhost:5173:

1. **Clear browser cache and hard reload:**
   - Chrome/Edge: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
   - Firefox: `Ctrl+F5` (Windows/Linux) or `Cmd+Shift+R` (Mac)

2. **Ensure dependencies are installed:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

3. **Check browser console for errors:**
   - Open DevTools (F12)
   - Look for red errors in Console tab
   - Common issues: module import errors, missing dependencies

4. **Try a different browser:**
   - Requires modern browser with WebRTC support
   - Recommended: Chrome, Firefox, Edge (latest versions)

### Connection fails between devices
- Ensure both devices are on the same network
- Check firewall isn't blocking WebRTC connections
- Try using the manual peer ID input instead of QR

### QR scanner not working
- Ensure HTTPS or localhost (required for camera access)
- Grant camera permissions when prompted
- Use manual peer ID input as fallback

### "PeerJS cloud server" errors
- The free PeerJS cloud server may have rate limits
- Consider setting up your own PeerJS server for production use

## Known Limitations

- **Camera access**: Only works over HTTPS or localhost
- **NAT traversal**: Some network configurations may prevent direct P2P connections
- **Browser compatibility**: Requires modern browser with WebRTC support
