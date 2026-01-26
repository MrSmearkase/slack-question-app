// This service handles the aggregation logic
// Currently, the main app.js handles aggregation directly
// This file can be extended for more complex aggregation logic

function normalizeNotification(notification) {
  return {
    ...notification,
    timestamp: notification.timestamp instanceof Date 
      ? notification.timestamp 
      : new Date(notification.timestamp)
  };
}

function sortByTimestamp(notifications) {
  return notifications.sort((a, b) => {
    const timeA = a.timestamp instanceof Date ? a.timestamp : new Date(a.timestamp);
    const timeB = b.timestamp instanceof Date ? b.timestamp : new Date(b.timestamp);
    return timeB - timeA; // Most recent first
  });
}

function filterNotifications(notifications, filters) {
  let filtered = [...notifications];

  if (filters.source) {
    filtered = filtered.filter(n => n.source === filters.source);
  }

  if (filters.type) {
    filtered = filtered.filter(n => n.type === filters.type);
  }

  if (filters.account) {
    filtered = filtered.filter(n => n.account === filters.account);
  }

  return filtered;
}

module.exports = {
  normalizeNotification,
  sortByTimestamp,
  filterNotifications
};
