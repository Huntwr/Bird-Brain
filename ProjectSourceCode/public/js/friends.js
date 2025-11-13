// Friends data management
let friends = [];
let friendRequests = [];
let selectedFriend = null;
let currentTab = 'friends';

function getUserStorageKey(suffix) {
    if (!window.currentUser || !window.currentUser.id) {
        console.error('Current user not available');
        return `birdBrain${suffix}`;
    }
    return `birdBrain${suffix}_user${window.currentUser.id}`;
}

function getStorageKeyForUser(suffix, userId) {
    return `birdBrain${suffix}_user${userId}`;
}

function clearAllFriendData() {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('birdBrain') || key.includes('Friends') || key.includes('Requests'))) {
            localStorage.removeItem(key);
        }
    }
}

function loadFriendsFromStorage() {
    const storedFriends = localStorage.getItem(getUserStorageKey('Friends'));
    if (storedFriends) {
        friends = JSON.parse(storedFriends);
    } else {
        friends = [];
    }

    const requestsKey = getUserStorageKey('IncomingRequests');
    console.log('Looking for requests with key:', requestsKey);
    const storedRequests = localStorage.getItem(requestsKey);
    console.log('Found stored requests:', storedRequests);
    if (storedRequests) {
        friendRequests = JSON.parse(storedRequests);
    } else {
        friendRequests = [];
    }
}

// Save friends to localStorage
function saveFriendsToStorage() {
    localStorage.setItem(getUserStorageKey('Friends'), JSON.stringify(friends));
    localStorage.setItem(getUserStorageKey('IncomingRequests'), JSON.stringify(friendRequests));
}

// Save friend requests to localStorage
function saveFriendRequests(requests) {
    friendRequests = requests || friendRequests;
    localStorage.setItem(getUserStorageKey('IncomingRequests'), JSON.stringify(friendRequests));
}

// Validate if email exists in the system
async function validateEmail(email) {
    try {
        const response = await fetch(`/api/users/check-email/${encodeURIComponent(email)}`);
        
        if (response.status === 404) {
            return { exists: false, message: `Email "${email}" does not exist in Bird Brain.` };
        }
        
        if (!response.ok) {
            return { exists: false, message: 'Unable to verify email. Please try again.' };
        }
        
        const userData = await response.json();
        return { exists: true, userData: userData };
        
    } catch (error) {
        console.error('Error validating email:', error);
        return { exists: false, message: 'Unable to verify email. Please check your connection.' };
    }
}

// Add a new friend
async function addFriend(friendData) {
    try {
        const response = await fetch('/api/friends/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                recipientEmail: friendData.email
            })
        });

        const result = await response.json();

        if (!result.success) {
            alert(result.message);
            return false;
        }

        const recipientStorageKey = getStorageKeyForUser('IncomingRequests', result.request.recipientId);
        console.log('Storing request with key:', recipientStorageKey);
        const existingRecipientRequests = JSON.parse(localStorage.getItem(recipientStorageKey) || '[]');
        
        const existingRequest = existingRecipientRequests.find(r => r.senderEmail === result.request.senderEmail);
        if (!existingRequest) {
            const incomingRequest = {
                id: result.request.id,
                senderId: result.request.senderId,
                senderName: result.request.senderName,
                senderEmail: result.request.senderEmail,
                status: 'pending',
                timestamp: result.request.timestamp,
                type: 'incoming'
            };
            
            existingRecipientRequests.push(incomingRequest);
            localStorage.setItem(recipientStorageKey, JSON.stringify(existingRecipientRequests));
            console.log('Successfully stored request for recipient:', result.request.recipientId, 'with key:', recipientStorageKey);
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

function removeFriend(friendId) {
    if (confirm('Are you sure you want to remove this friend?')) {
        friends = friends.filter(f => f.id !== friendId);
        saveFriendsToStorage();
        selectedFriend = null;
        renderFriendsList();
        renderSelectedFriend();
    }
}

function loadFriendsPage() {
    loadFriendsFromStorage();
    initializeTabs();
    renderCurrentTab();
    updateTabCounts();
    renderSelectedFriend();
}

function renderFriendsList() {
    const friendsList = document.querySelector('.friends-list');
    
    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div class="friends-header">
                <h3>Friends (0)</h3>
                <button class="add-friend-btn" onclick="openAddFriendModal()">+ Add Friend</button>
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
            friendsHTML += `
                <div class="friend-item" onclick="selectFriend(${index})" data-friend-id="${friend.id}">
                    <div class="friend-info">
                        <div class="friend-name">${friend.name}</div>
                        <div class="friend-email">${friend.email}</div>
                        <div class="friend-status">${friend.status}</div>
                    </div>
                    <div class="friend-actions">
                        <button class="remove-friend-btn" onclick="event.stopPropagation(); removeFriend(${friend.id})">&times;</button>
                    </div>
                </div>
            `;
        });
        
        friendsHTML += '</div>';
        friendsList.innerHTML = friendsHTML;
    }
}

function renderSelectedFriend() {
    const postsSection = document.querySelector('.posts-section');

    if (currentTab === 'invite') {
        postsSection.innerHTML = '';
        return;
    }
    
    if (selectedFriend === null) {
        postsSection.innerHTML = `
            <div class="empty-state">
                <h3>Select a Friend</h3>
                <p>Choose a friend from the list to view their posts and activity.</p>
            </div>
        `;
    } else {
        const friend = friends[selectedFriend];
        if (!friend) {
            selectedFriend = null;
            renderSelectedFriend();
            return;
        }

        if (friend.posts.length === 0) {
            postsSection.innerHTML = `
                <div class="posts-header">
                    <h3>${friend.name}</h3>
                    <div>
                        <span>Posts (0)</span>
                        <span>Likes (${friend.likes || 0})</span>
                        <button class="like-button" onclick="likeFriend(${selectedFriend})">♥</button>
                    </div>
                </div>
                <div class="empty-state">
                    <h4>No Posts Yet</h4>
                    <p>${friend.name} hasn't shared any bird posts yet.</p>
                    <button class="add-post-btn" onclick="addSamplePost(${selectedFriend})">Add Sample Post</button>
                </div>
            `;
        } else {
            let postsHTML = `
                <div class="posts-header">
                    <h3>${friend.name}</h3>
                    <div>
                        <span>Posts (${friend.posts.length})</span>
                        <span>Likes (${friend.likes || 0})</span>
                        <button class="like-button" onclick="likeFriend(${selectedFriend})">♥</button>
                    </div>
                </div>
                <div class="posts-grid">
            `;
            
            friend.posts.forEach((post, postIndex) => {
                postsHTML += `
                    <div class="post-item" onclick="viewPost(${selectedFriend}, ${postIndex})">
                        <div class="post-content">${post.content}</div>
                        <div class="post-date">${formatDate(post.date)}</div>
                    </div>
                `;
            });
            
            postsHTML += '</div>';
            postsSection.innerHTML = postsHTML;
        }
    }
}

function selectFriend(index) {
    selectedFriend = index;
    document.querySelectorAll('.friend-item').forEach((item, i) => {
        if (i === index) {
            item.classList.add('selected');
        } else {
            item.classList.remove('selected');
        }
    });
    renderSelectedFriend();
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

document.addEventListener('DOMContentLoaded', function() {
    loadFriendsPage();
});

window.onclick = function(event) {
    const modal = document.getElementById('addFriendModal');
    if (event.target === modal) {
        closeAddFriendModal();
    }
}