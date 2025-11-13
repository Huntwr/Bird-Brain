// Friends Tab Management Functions
function initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
}

function switchTab(tabName) {
    currentTab = tabName;
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.tab === tabName);
    });
    selectedFriend = null;

    renderCurrentTab();
    renderSelectedFriend();
}

function updateTabCounts() {
    const friendsCount = friends.length;
    const favoritesCount = friends.filter(f => f.isFavorite).length;
    const requestsCount = friendRequests.length;
    
    document.getElementById('friends-count').textContent = friendsCount;
    document.getElementById('favorites-count').textContent = favoritesCount;
    document.getElementById('requests-count').textContent = requestsCount;
}

function renderCurrentTab() {
    switch(currentTab) {
        case 'friends':
            renderFriendsList();
            break;
        case 'favorites':
            renderFavoritesList();
            break;
        case 'requests':
            renderRequestsList();
            break;
        case 'invite':
            renderInviteTab();
            break;
        default:
            renderFriendsList();
    }
}

function renderFavoritesList() {
    const friendsList = document.querySelector('.friends-list');
    const favoriteFriends = friends.filter(f => f.isFavorite);
    
    if (favoriteFriends.length === 0) {
        friendsList.innerHTML = `
            <div class="friends-header">
                <h3>Favorite Friends (0)</h3>
            </div>
            <div class="empty-state">
                <h4>No Favorite Friends</h4>
                <p>You haven't marked any friends as favorites yet. Click the ⭐ icon next to a friend to add them to your favorites!</p>
            </div>
        `;
    } else {
        let friendsHTML = `
            <div class="friends-header">
                <h3>Favorite Friends (${favoriteFriends.length})</h3>
            </div>
            <div class="friends-scroll">
        `;
        
        favoriteFriends.forEach((friend) => {
            const originalIndex = friends.findIndex(f => f.id === friend.id);
            friendsHTML += `
                <div class="friend-item" onclick="selectFriend(${originalIndex})" data-friend-id="${friend.id}">
                    <div class="friend-info">
                        <div class="friend-name">${friend.name} ⭐</div>
                        <div class="friend-email">${friend.email}</div>
                        <div class="friend-status">${friend.status}</div>
                    </div>
                    <div class="friend-actions">
                        <button class="favorite-btn favorited" onclick="event.stopPropagation(); toggleFavorite(${friend.id})" title="Remove from favorites">⭐</button>
                        <button class="remove-friend-btn" onclick="event.stopPropagation(); removeFriend(${friend.id})">&times;</button>
                    </div>
                </div>
            `;
        });
        
        friendsHTML += '</div>';
        friendsList.innerHTML = friendsHTML;
    }
}

function renderRequestsList() {
    const friendsList = document.querySelector('.friends-list');
    
    if (friendRequests.length === 0) {
        friendsList.innerHTML = `
            <div class="friends-header">
                <h3>Friend Requests (0)</h3>
            </div>
            <div class="empty-state">
                <h4>No Friend Requests</h4>
                <p>You don't have any pending friend requests at the moment.</p>
                <p style="font-size: 12px; color: #666; margin-top: 10px;">
                    When someone sends you a friend request, it will appear here.
                </p>
            </div>
        `;
    } else {
        let requestsHTML = `
            <div class="friends-header">
                <h3>Friend Requests (${friendRequests.length})</h3>
            </div>
            <div class="friends-scroll">
        `;
        
        friendRequests.forEach((request, index) => {
            requestsHTML += `
                <div class="friend-item request-item">
                    <div class="friend-info">
                        <div class="friend-name">${request.senderName}</div>
                        <div class="friend-email">${request.senderEmail}</div>
                        <div class="request-date">
                            Received ${formatDate(request.timestamp)}
                        </div>
                    </div>
                    <div class="request-actions">
                        <button class="accept-btn" onclick="acceptFriendRequest(${index})">Accept</button>
                        <button class="decline-btn" onclick="declineFriendRequest(${index})">Decline</button>
                    </div>
                </div>
            `;
        });
        
        requestsHTML += '</div>';
        friendsList.innerHTML = requestsHTML;
    }
}

function renderInviteTab() {
    const friendsList = document.querySelector('.friends-list');
    
    friendsList.innerHTML = `
        <div class="friends-header">
            <h3>Invite</h3>
        </div>
    `;
}

function toggleFavorite(friendId) {
    const friend = friends.find(f => f.id === friendId);
    if (friend) {
        friend.isFavorite = !friend.isFavorite;
        saveFriendsToStorage();
        renderCurrentTab();
        updateTabCounts();
    }
}

function acceptFriendRequest(requestIndex) {
    const request = friendRequests[requestIndex];

    if (request.type === 'outgoing') {
        alert('You cannot accept your own outgoing request!');
        return;
    }

    const newFriend = {
        id: Date.now(),
        userId: request.senderId || request.userId,
        name: request.senderName || request.name,
        email: request.senderEmail || request.email,
        status: 'Online',
        likes: 0,
        posts: [],
        dateAdded: new Date().toISOString(),
        isFavorite: false
    };
    
    friends.push(newFriend);
    
    friendRequests.splice(requestIndex, 1);
    
    saveFriendsToStorage();
    renderCurrentTab();
    updateTabCounts();
    
    alert(`${request.name} is now your friend!`);
}

function declineFriendRequest(requestIndex) {
    const request = friendRequests[requestIndex];
    if (confirm(`Decline friend request from ${request.senderName || request.name}?`)) {
        friendRequests.splice(requestIndex, 1);
        saveFriendsToStorage();
        renderCurrentTab();
        updateTabCounts();
    }
}

function cancelFriendRequest(requestIndex) {
    const request = friendRequests[requestIndex];
    if (confirm(`Cancel friend request to ${request.recipientName || request.name}?`)) {
        friendRequests.splice(requestIndex, 1);
        saveFriendsToStorage();
        renderCurrentTab();
        updateTabCounts();
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
        return 'today';
    } else if (diffDays === 2) {
        return 'yesterday';
    } else if (diffDays <= 7) {
        return `${diffDays - 1} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}
