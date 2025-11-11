// Friends Page JavaScript - Bird Brain App
// Handles friend management, storage, and interactions

// Friends data management
let friends = [];
let selectedFriend = null;

// Load friends from localStorage on page load
function loadFriendsFromStorage() {
    const storedFriends = localStorage.getItem('birdBrainFriends');
    if (storedFriends) {
        friends = JSON.parse(storedFriends);
    }
}

// Save friends to localStorage
function saveFriendsToStorage() {
    localStorage.setItem('birdBrainFriends', JSON.stringify(friends));
}

// Add a new friend
function addFriend(friendData) {
    // Check if friend already exists
    const existingFriend = friends.find(f => f.username === friendData.username);
    if (existingFriend) {
        alert('This friend is already in your list!');
        return false;
    }

    const newFriend = {
        id: Date.now(), // Simple ID generation
        name: friendData.name,
        username: friendData.username,
        status: 'Online',
        likes: 0,
        posts: [],
        dateAdded: new Date().toISOString()
    };

    friends.push(newFriend);
    saveFriendsToStorage();
    renderFriendsList();
    closeAddFriendModal();
    return true;
}

// Remove a friend
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
    renderFriendsList();
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
            <div class="empty-state">
                <h4>No Friends Yet</h4>
                <p>You haven't added any friends yet. Start connecting with other bird enthusiasts!</p>
                <button class="find-friends-btn" onclick="openAddFriendModal()">Add Your First Friend</button>
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
                        <div class="friend-username">@${friend.username}</div>
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
                    <h3>${friend.name} (@${friend.username})</h3>
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
                    <h3>${friend.name} (@${friend.username})</h3>
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
    // Update visual selection
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

function handleAddFriendSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const friendData = {
        name: formData.get('friendName').trim(),
        username: formData.get('friendUsername').trim()
    };

    // Validate input
    if (!friendData.name || !friendData.username) {
        alert('Please fill in all fields');
        return;
    }

    if (friendData.username.includes(' ')) {
        alert('Username cannot contain spaces');
        return;
    }

    addFriend(friendData);
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

// Initialize page when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    loadFriendsPage();
});

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('addFriendModal');
    if (event.target === modal) {
        closeAddFriendModal();
    }
}