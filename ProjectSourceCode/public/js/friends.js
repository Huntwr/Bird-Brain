// Friends data management
let friends = [];
let friendRequests = [];
let selectedFriend = null;
let currentTab = 'friends';

// Load friends from database
async function loadFriendsFromDatabase() {
    try {
        const response = await fetch('/api/friends', {
            credentials: 'include'
        });
        if (response.ok) {
            friends = await response.json();
        } else {
            console.error('Failed to load friends');
            friends = [];
        }
    } catch (error) {
        console.error('Error loading friends:', error);
        friends = [];
    }
}

// Load friend requests from database
async function loadFriendRequestsFromDatabase() {
    try {
        console.log('Loading friend requests from database...');
        const response = await fetch('/api/friends/requests/incoming', {
            credentials: 'include'
        });
        console.log('Response status:', response.status);
        if (response.ok) {
            friendRequests = await response.json();
        } else {
            console.error('Failed to load friend requests, status:', response.status);
            friendRequests = [];
        }
    } catch (error) {
        console.error('Error loading friend requests:', error);
        friendRequests = [];
    }
}

// Render current tab - delegates to friends-tabs.js based on currentTab
function renderCurrentTab() {
    switch(currentTab) {
        case 'friends':
            renderFriendsList();
            break;
        case 'favorites':
            renderFavoritesList();
            break;
        case 'requests':
            renderFriendRequests();
            break;
        default:
            renderFriendsList();
    }
}

// Add a new friend request
async function addFriend(friendData) {
    try {
        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                recipientEmail: friendData.email
            })
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message);
            return false;
        }

        alert(result.message);
        closeAddFriendModal();
        return true;
    } catch (error) {
        console.error('Error sending friend request:', error);
        alert('Error sending friend request. Please try again.');
        return false;
    }
}

// Accept a friend request
async function acceptFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/accept/${requestId}`, {
            method: 'POST',
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            alert('Friend request accepted!');
            await loadFriendsFromDatabase();
            await loadFriendRequestsFromDatabase();
            renderCurrentTab();
            updateTabCounts();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error accepting friend request:', error);
        alert('Error accepting friend request. Please try again.');
    }
}

// Decline a friend request
async function declineFriendRequest(requestId) {
    try {
        const response = await fetch(`/api/friends/decline/${requestId}`, {
            method: 'POST',
            credentials: 'include'
        });

        const result = await response.json();

        if (result.success) {
            alert('Friend request declined');
            await loadFriendRequestsFromDatabase();
            renderCurrentTab();
            updateTabCounts();
        } else {
            alert(result.message);
        }
    } catch (error) {
        console.error('Error declining friend request:', error);
        alert('Error declining friend request. Please try again.');
    }
}

// Remove a friend
async function removeFriend(friendId) {
    if (confirm('Are you sure you want to remove this friend?')) {
        try {
            const response = await fetch(`/api/friends/${friendId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            const result = await response.json();

            if (result.success) {
                alert('Friend removed successfully');
                selectedFriend = null;
                await loadFriendsFromDatabase();
                renderCurrentTab();
                updateTabCounts();
                renderSelectedFriend();
            } else {
                alert(result.message);
            }
        } catch (error) {
            console.error('Error removing friend:', error);
            alert('Error removing friend. Please try again.');
        }
    }
}

// Load the friends page
async function loadFriendsPage() {
    await loadFriendsFromDatabase();
    await loadFriendRequestsFromDatabase();
    initializeTabs();
    renderCurrentTab();
    updateTabCounts();
    renderSelectedFriend();
}

// Render friends list
function renderFriendsList() {
    const friendsList = document.querySelector('.friends-list');
    
    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div class="friends-header">
                <h3>Friends (0)</h3>
                <button class="add-friend-btn" onclick="openAddFriendModal()">+ Add Friend</button>
            </div>
            <div class="empty-state">
                <p>No friends yet. Add some friends to start chatting!</p>
            </div>
        `;
    } else {
        let friendsHTML = `
            <div class="friends-header">
                <h3>Friends (${friends.length})</h3>
                <button class="add-friend-btn" onclick="openAddFriendModal()">+ Add Friend</button>
            </div>
            <div class="friends-scroll">
        `;
        
        friends.forEach((friend, index) => {
            const profilePic = friend.profile_picture ? friend.profile_picture : '/images/default_pfp.png';
            const starClass = friend.isFavorite ? 'favorited' : '';
            const starIcon = friend.isFavorite ? 
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ffd700" stroke="#ffd700" stroke-width="1">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>` :
                `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ddd" stroke-width="2">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>`;
            
            friendsHTML += `
                <div class="friend-card ${selectedFriend && selectedFriend.id === friend.id ? 'selected' : ''}" 
                     onclick="selectFriend(${index})" data-friend-id="${friend.id}">
                    <div class="friend-avatar-container">
                        <img src="${profilePic}" alt="${friend.name}" class="friend-avatar">
                        <div class="online-indicator"></div>
                    </div>
                    <div class="friend-details">
                        <div class="friend-name">${friend.name}</div>
                    </div>
                    <div class="friend-actions">
                        <div class="action-buttons">
                            <button class="favorite-btn ${starClass}" onclick="event.stopPropagation(); window.simpleFavoriteToggle(${friend.id})" title="${friend.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                                ${starIcon}
                            </button>
                            <button class="remove-friend-btn" onclick="event.stopPropagation(); removeFriend(${friend.id})" title="Remove friend">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        friendsHTML += '</div>';
        friendsList.innerHTML = friendsHTML;
    }
}

// Render favorites list
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
                <div class="friend-card ${selectedFriend && selectedFriend.id === friend.id ? 'selected' : ''}" 
                     onclick="selectFriend(${originalIndex})" data-friend-id="${friend.id}">
                    <div class="friend-avatar-container">
                        <img src="${profilePic}" alt="${friend.name}" class="friend-avatar">
                        <div class="online-indicator"></div>
                    </div>
                    <div class="friend-details">
                        <div class="friend-name">${friend.name} ⭐</div>
                    </div>
                    <div class="friend-actions">
                        <div class="action-buttons">
                            <button class="favorite-btn favorited" onclick="event.stopPropagation(); toggleFavorite(${friend.id})" title="Remove from favorites">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="#ffd700" stroke="#ffd700" stroke-width="1">
                                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                            </button>
                            <button class="remove-friend-btn" onclick="event.stopPropagation(); removeFriend(${friend.id})" title="Remove friend">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        friendsHTML += '</div>';
        friendsList.innerHTML = friendsHTML;
    }
}

// Render friend requests list
function renderFriendRequests() {
    const friendsList = document.querySelector('.friends-list');
    
    if (friendRequests.length === 0) {
        friendsList.innerHTML = `
            <div class="requests-header">
                <h3>Friend Requests (0)</h3>
            </div>
            <div class="empty-state">
                <p>No pending friend requests.</p>
            </div>
        `;
    } else {
        let requestsHTML = `
            <div class="requests-header">
                <h3>Friend Requests (${friendRequests.length})</h3>
            </div>
            <div class="requests-scroll">
        `;
        
        friendRequests.forEach((request, index) => {
            const profilePic = request.requester_profile_picture ? request.requester_profile_picture : '/images/default_pfp.png';
            const requestDate = new Date(request.created_at).toLocaleDateString();
            
            requestsHTML += `
                <div class="request-item">
                    <img src="${profilePic}" alt="${request.requester_name}" class="request-avatar">
                    <div class="request-info">
                        <div class="requester-name">${request.requester_name}</div>
                        <div class="requester-email">${request.requester_email}</div>
                        <div class="request-date">Sent ${requestDate}</div>
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

// Select a friend
function selectFriend(index) {
    selectedFriend = friends[index];
    renderFriendsList(); // Re-render to show selection
    renderSelectedFriend();
}

// Render selected friend details
async function renderSelectedFriend() {
    const postsSection = document.querySelector('.posts-section');

    if (currentTab === 'invite') {
        postsSection.innerHTML = '';
        return;
    }

    if (currentTab === 'requests') {
        postsSection.innerHTML = `
            <div class="requests-info">
                <h3>Friend Requests</h3>
                <p>Manage your incoming friend requests here. Accept or decline requests from other users.</p>
            </div>
        `;
        return;
    }
    
    if (selectedFriend === null) {
        postsSection.innerHTML = `
            <div class="no-friend-selected">
                <h3>Select a friend</h3>
                <p>Choose a friend from the list to see their profile and bird posts.</p>
            </div>
        `;
        return;
    }

    const profilePic = selectedFriend.profile_picture ? selectedFriend.profile_picture : '/images/default_pfp.png';
    
    // Show loading state
    postsSection.innerHTML = `
        <div class="friend-profile">
            <div class="profile-header">
                <img src="${profilePic}" alt="${selectedFriend.name}" class="profile-avatar">
                <div class="profile-info">
                    <h2>${selectedFriend.name}</h2>
                </div>
            </div>
            <div class="posts-loading">
                <p>Loading bird posts...</p>
            </div>
        </div>
    `;
    
    try {
        // Load friend's bird posts
        const response = await fetch(`/api/users/${selectedFriend.id}/posts`, {
            credentials: 'include'
        });
        
        if (response.ok) {
            const posts = await response.json();
            renderFriendPosts(posts);
        } else {
            postsSection.innerHTML = `
                <div class="friend-profile">
                    <div class="profile-header">
                        <img src="${profilePic}" alt="${selectedFriend.name}" class="profile-avatar">
                        <div class="profile-info">
                            <h2>${selectedFriend.name}</h2>
                        </div>
                    </div>
                    <div class="posts-error">
                        <p>Error loading posts</p>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading friend posts:', error);
        postsSection.innerHTML = `
            <div class="friend-profile">
                <div class="profile-header">
                    <img src="${profilePic}" alt="${selectedFriend.name}" class="profile-avatar">
                    <div class="profile-info">
                        <h2>${selectedFriend.name}</h2>
                    </div>
                </div>
                <div class="posts-error">
                    <p>Error loading posts</p>
                </div>
            </div>
        `;
    }
}

// Render friend's bird posts in a grid
function renderFriendPosts(posts) {
    const postsSection = document.querySelector('.posts-section');
    const profilePic = selectedFriend.profile_picture ? selectedFriend.profile_picture : '/images/default_pfp.png';
    
    let postsHTML = '';
    
    if (posts.length === 0) {
        postsHTML = `
            <div class="no-posts">
                <div class="no-posts-icon">🐦</div>
                <h3>No bird posts yet</h3>
                <p>${selectedFriend.name} hasn't posted any bird sightings yet.</p>
            </div>
        `;
    } else {
        postsHTML = `
            <div class="posts-grid">
        `;
        
        posts.forEach((post) => {
            const postDate = new Date(post.sighting_date_at).toLocaleDateString();
            const sightingDate = post.sighting_date ? new Date(post.sighting_date).toLocaleDateString() : 'Unknown date';
            
            postsHTML += `
                <div class="post-card">
                    <div class="post-header">
                        <h4 class="bird-species">${post.species || 'Unknown Species'}</h4>
                        <span class="post-date">${postDate}</span>
                    </div>
                    <div class="post-details">
                        <div class="post-info">
                            <span class="location">📍 ${post.location || 'Unknown location'}</span>
                            <span class="sighting-date">🗓️ Spotted on ${sightingDate}</span>
                        </div>
                        ${post.notes ? `<div class="post-notes">${post.notes}</div>` : ''}
                    </div>
                </div>
            `;
        });
        
        postsHTML += '</div>';
    }
    
    postsSection.innerHTML = `
        <div class="friend-profile">
            <div class="profile-header">
                <img src="${profilePic}" alt="${selectedFriend.name}" class="profile-avatar">
                <div class="profile-info">
                    <h2>${selectedFriend.name}</h2>
                    <p class="posts-count">${posts.length} bird ${posts.length === 1 ? 'post' : 'posts'}</p>
                </div>
            </div>
            ${postsHTML}
        </div>
    `;
}

// Update tab counts
function updateTabCounts() {
    const favoritesCount = friends.filter(f => f.isFavorite).length;
    document.getElementById('friends-count').textContent = friends.length;
    document.getElementById('requests-count').textContent = friendRequests.length;
    document.getElementById('favorites-count').textContent = favoritesCount;
}

function likeFriend(friendIndex) {
    if (friendIndex !== null && friends[friendIndex]) {
        friends[friendIndex].likes = (friends[friendIndex].likes || 0) + 1;
        saveFriendsToStorage();
        renderSelectedFriend();
    }
}

function addSamplePost(friendIndex) {
    if (friendIndex !== null && friends[friendIndex]) {
        const samplePosts = [
            "Spotted a beautiful Cardinal this morning!",
            "The Blue Jays are back in my garden 🐦",
            "Amazing owl sighting during my evening walk",
            "Found a rare Goldfinch today - so exciting!",
            "Building a new bird feeder this weekend"
        ];
        
        const randomPost = samplePosts[Math.floor(Math.random() * samplePosts.length)];
        friends[friendIndex].posts.push({
            content: randomPost,
            date: new Date().toISOString(),
            likes: 0
        });
        
        saveFriendsToStorage();
        renderSelectedFriend();
    }
}

function openAddFriendModal() {
    document.getElementById('addFriendModal').style.display = 'block';
}

function closeAddFriendModal() {
    document.getElementById('addFriendModal').style.display = 'none';
    document.getElementById('addFriendForm').reset();
}

async function handleAddFriendSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const email = formData.get('friendEmail').trim();

    if (!email) {
        alert('Please enter an email address');
        return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address');
        return;
    }

    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Checking...';
    submitButton.disabled = true;

    try {
        const friendData = {
            email: email
        };

        await addFriend(friendData);
    } finally {
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now - date) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    if (diffInHours < 48) return 'Yesterday';
    return date.toLocaleDateString();
}

function viewPost(friendIndex, postIndex) {
    const friend = friends[friendIndex];
    const post = friend.posts[postIndex];
    alert(`${friend.name}'s Post:\n\n"${post.content}"\n\nPosted: ${formatDate(post.date)}`);
}

// Simple favorite toggle for testing
window.simpleFavoriteToggle = function(friendId) {
    console.log('Simple toggle called for friend ID:', friendId);
    alert('Toggling favorite for friend ID: ' + friendId);
    
    // Find the friend
    const friend = friends.find(f => f.id === friendId);
    if (!friend) {
        console.log('Friend not found');
        return;
    }
    
    // Toggle the favorite status locally (for immediate testing)
    friend.isFavorite = !friend.isFavorite;
    console.log('Friend', friend.name, 'isFavorite now:', friend.isFavorite);
    
    // Update the display
    renderCurrentTab();
    updateTabCounts();
    
    // Also call the API in the background
    toggleFavoriteAPI(friendId);
}

// API call for favorite toggle
async function toggleFavoriteAPI(friendId) {
    try {
        const friend = friends.find(f => f.id === friendId);
        const method = friend.isFavorite ? 'POST' : 'DELETE';
        const url = `/api/friends/${friendId}/favorite`;
        
        const response = await fetch(url, {
            method: method,
            credentials: 'include'
        });
        
        const result = await response.json();
        console.log('API result:', result);
    } catch (error) {
        console.error('API error:', error);
    }
}

// Toggle friend favorite status
window.toggleFavorite = async function(friendId) {
    alert('toggleFavorite function called! Friend ID: ' + friendId);
    console.log('toggleFavorite called with friendId:', friendId);
    try {
        const friend = friends.find(f => f.id === friendId);
        if (!friend) {
            console.error('Friend not found:', friendId);
            return;
        }
        
        console.log('Friend found:', friend.name, 'isFavorite:', friend.isFavorite);
        
        const isFavorite = friend.isFavorite;
        const method = isFavorite ? 'DELETE' : 'POST';
        const url = `/api/friends/${friendId}/favorite`;
        
        console.log('Making API call:', method, url);
        
        const response = await fetch(url, {
            method: method,
            credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        
        const result = await response.json();
        console.log('API result:', result);
        
        if (result.success) {
            // Update local state
            friend.isFavorite = !isFavorite;
            console.log('Updated friend.isFavorite to:', friend.isFavorite);
            
            // Re-render the current tab to show updated state
            renderCurrentTab();
            updateTabCounts();
            
            // Show brief success message
            console.log(result.message);
        } else {
            console.error('API error:', result.message);
            alert(result.message);
        }
    } catch (error) {
        console.error('Error toggling favorite:', error);
        alert('Error updating favorite status. Please try again.');
    }
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('Friends.js loaded successfully');
    loadFriendsPage();
});

window.onclick = function(event) {
    const modal = document.getElementById('addFriendModal');
    if (event.target === modal) {
        closeAddFriendModal();
    }
}