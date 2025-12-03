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
            const profilePic = friend.profile_picture ? friend.profile_picture : '/images/default_pfp.png';
            
            friendsHTML += `
                <div class="friend-card" onclick="selectFriend(${originalIndex})" data-friend-id="${friend.id}">
                    <div class="friend-avatar-container">
                        <img src="${profilePic}" alt="${friend.name}" class="friend-avatar">
                        <div class="online-indicator"></div>
                    </div>
                    <div class="friend-details">
                        <div class="friend-name">${friend.name} ⭐</div>
                    </div>
                    <div class="friend-actions">
                        <button class="favorite-btn favorited" onclick="event.stopPropagation(); toggleFavorite(${friend.id})" title="Remove from favorites">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                            </svg>
                        </button>
                        <button class="remove-friend-btn" onclick="event.stopPropagation(); removeFriend(${friend.id})" title="Remove friend">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
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
            const requestDate = new Date(request.created_at).toLocaleDateString();
            
            requestsHTML += `
                <div class="friend-item request-item">
                    <div class="friend-info">
                        <div class="friend-name">${request.requester_name || 'Unknown'}</div>
                        <div class="friend-email">${request.requester_email || 'No email'}</div>
                        <div class="request-date">
                            Received ${requestDate}
                        </div>
                    </div>
                    <div class="request-actions">
                        <button class="accept-btn" onclick="acceptFriendRequest(${request.id})">Accept</button>
                        <button class="decline-btn" onclick="declineFriendRequest(${request.id})">Decline</button>
                    </div>
                </div>
            `;
        });
        
        requestsHTML += '</div>';
        friendsList.innerHTML = requestsHTML;
    }
}

// Toggle friend favorite status (delegated to friends.js)
function toggleFavorite(friendId) {
    if (window.toggleFavorite) {
        window.toggleFavorite(friendId);
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
