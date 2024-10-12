import React, { useEffect } from 'react';
import { Level } from 'level';
import leveljs from 'level-js';
import './App.css';

// Define the maximum threshold (in bytes) for localStorage
const MAX_STORAGE_THRESHOLD = 2.5; // Example size in bytes, you can adjust it

// Pre-initialized list of ignored origins
const IGNORED_ORIGINS = ['example.com', 'bad origin'];

// Function to calculate the size of localStorage in bytes
function calculateLocalStorageSize() {
  return new Blob(Object.values(localStorage)).size;
}

// Standalone class to handle storage and database logic
class StorageHandler {
  db;
  maxStorageThreshold;
  constructor() {
    this.db = new Level('my-database');
    this.maxStorageThreshold = MAX_STORAGE_THRESHOLD;
  }

  // Function to delete items based on their priority when storage exceeds threshold
  async checkAndCleanupStorage() {
    const storageSize = calculateLocalStorageSize();

    if (storageSize > this.maxStorageThreshold) {
      console.log(`Storage exceeded ${this.maxStorageThreshold} bytes. Cleaning up...`);

      // Get all keys and values in the database
      const keys = await this.db.keys().all();
      const entries = [];

      for (const key of keys) {
        const entry = await this.db.get(key);
        entries.push({ key, ...JSON.parse(entry) });
      }

      // Sort entries by priority (ascending)
      entries.sort((a, b) => a.priority - b.priority);

      // Remove entries with the lowest priority, except immutable ones
      for (const entry of entries) {
        if (storageSize <= this.maxStorageThreshold) break; // Stop when under threshold
        if (!entry.immutableAmount) {
          await this.db.del(entry.key); // Delete only if not immutable
          console.log(`Deleted key: ${entry.key} to free space.`);
        }
      }
    }
  }

  // Function to add a key-value pair with priority and immutableAmount
  async addEntry(key: any, value: any, priority: any, immutableAmount: any) {
    // Prepare the entry object
    const entry = {
      value,
      priority, // Priority level (e.g., 1 = highest, 10 = lowest)
      immutableAmount, // Boolean to prevent deletion
    };

    // Check storage size before adding a new entry
    await this.checkAndCleanupStorage();

    // Put the key-value pair into the database
    await this.db.put(key, JSON.stringify(entry));
    console.log(`Added key: ${key} with priority: ${priority} and immutableAmount: ${immutableAmount}`);
  }

  // Function to retrieve a key from the database, accepting only allowed origins
  async getEntry(key: any, originRequestor: any) {
    // Check if the requestor is in the ignored list
    if (IGNORED_ORIGINS.includes(originRequestor)) {
      console.log(`Ignoring read request from ${originRequestor}`);
      return null; // Reject the request if the origin is ignored
    }

    // If origin is allowed, retrieve the entry
    try {
      const entry = await this.db.get(key);
      const parsedEntry = JSON.parse(entry);
      console.log(`Retrieved value for ${key}:`, parsedEntry);
      return parsedEntry;
    } catch (error) {
      console.error(`Error retrieving value for ${key}:`, error);
      return null;
    }
  }
}

const storageHandler = new StorageHandler()

// React component
const App = () => {

  // Store data while ignoring certain origin requestors
  const store = async (originRequestor: any) => {
    if (IGNORED_ORIGINS.includes(originRequestor)) {
      console.log(`Ignoring storage request from ${originRequestor}`);
      return;
    }

    await storageHandler.addEntry('id-immutable', '232', 1, true); // Immutable entry with higher priority
    await storageHandler.addEntry('id', '238', 1, false); // Normal entry with priority
    await storageHandler.addEntry('id-test-priority', '240', 13, false); // Entry with low priority
    await storageHandler.addEntry('id-bad-origin', '258', 1, true); // Entry with low priority

    let i = 0;
    let timeBeginning = String(Date.now());

    await storageHandler.addEntry('time' + timeBeginning, timeBeginning, 5, false); // Normal entry

    while (i < 119) {
      await storageHandler.addEntry('time' + String(Date.now()), String(Date.now()), 5, false); // Normal entry
      i++;
    }

    // Retrieve values
    const timeEntry = await storageHandler.getEntry('time' + timeBeginning, originRequestor);
    const idEntry = await storageHandler.getEntry('id', originRequestor);
    const idImmutable = await storageHandler.getEntry('id-immutable', originRequestor);
    const testPriority = await storageHandler.getEntry('id-test-priority', originRequestor);
    const testPriorityBadOrigin = await storageHandler.getEntry('id-bad-origin', 'bad origin');

    console.log('time origin, ', timeEntry);
    console.log('with high priority, should be null',idEntry);
    console.log('test immutable, should have a value',idImmutable);
    console.log('test priority, should be null',testPriority);
    console.log('bad origin, should be null',testPriorityBadOrigin)
  }

  return (
    <div>
      <button onClick={() => store('some-origin.com')}>Store Data</button>
      <p>open console to view tests</p>
    </div>
  );
}

export default App;