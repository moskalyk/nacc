#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <string.h>
#include <time.h>
#include <fcntl.h>
#include <unistd.h>
#include <sys/file.h>
#include <sys/stat.h>
#include <stdbool.h>

#define MAX_LOG_ENTRY_SIZE 256
#define MAILBOX_SIZE 10
#define LOG_FILE "log.json"

// Log entry structure
typedef struct {
    char log_entry[MAX_LOG_ENTRY_SIZE];
    unsigned long timestamp;
} LogEntry;

// Mailbox structure for message passing
typedef struct {
    LogEntry entries[MAILBOX_SIZE];
    int head;
    int tail;
    pthread_mutex_t lock;
    pthread_cond_t not_empty;
    pthread_cond_t not_full;
} Mailbox;

// Initialize mailbox
void init_mailbox(Mailbox *mailbox) {
    mailbox->head = 0;
    mailbox->tail = 0;
    pthread_mutex_init(&mailbox->lock, NULL);
    pthread_cond_init(&mailbox->not_empty, NULL);
    pthread_cond_init(&mailbox->not_full, NULL);
}

// Send a log entry to the mailbox
void send_message(Mailbox *mailbox, LogEntry entry) {
    pthread_mutex_lock(&mailbox->lock);
    while ((mailbox->tail + 1) % MAILBOX_SIZE == mailbox->head) {
        pthread_cond_wait(&mailbox->not_full, &mailbox->lock);
    }
    mailbox->entries[mailbox->tail] = entry;
    mailbox->tail = (mailbox->tail + 1) % MAILBOX_SIZE;
    pthread_cond_signal(&mailbox->not_empty);
    pthread_mutex_unlock(&mailbox->lock);
}

// Receive a log entry from the mailbox
LogEntry receive_message(Mailbox *mailbox) {
    pthread_mutex_lock(&mailbox->lock);
    while (mailbox->head == mailbox->tail) {
        pthread_cond_wait(&mailbox->not_empty, &mailbox->lock);
    }
    LogEntry entry = mailbox->entries[mailbox->head];
    mailbox->head = (mailbox->head + 1) % MAILBOX_SIZE;
    pthread_cond_signal(&mailbox->not_full);
    pthread_mutex_unlock(&mailbox->lock);
    return entry;
}

// Check if log file is empty
bool is_file_empty(const char *filename) {
    struct stat st;
    if (stat(filename, &st) == 0) {
        return st.st_size == 0;
    }
    return true;
}

// Append log entry as JSON to the log file
void append_to_log(LogEntry entry) {
    FILE *file = fopen(LOG_FILE, "r+");
    if (file == NULL) {
        // If the file doesn't exist, create it
        file = fopen(LOG_FILE, "w");
        if (file == NULL) {
            perror("fopen");
            exit(EXIT_FAILURE);
        }
    }

    // Lock the file for writing (exclusive lock)
    int fd = fileno(file);
    if (flock(fd, LOCK_EX) != 0) {
        perror("flock");
        fclose(file);
        exit(EXIT_FAILURE);
    }

    // Check if the file is empty
    bool first_entry = is_file_empty(LOG_FILE);

    // If it's a new file, start the JSON array
    if (first_entry) {
        fprintf(file, "[\n");
    } else {
        // Move the file pointer to just before the closing bracket
        fseek(file, -2, SEEK_END);
        fprintf(file, ",\n");
    }

    // Append the log entry as a JSON object
    fprintf(file, "  {\n    \"timestamp\": %lu,\n    \"log_entry\": \"%s\"\n  }\n]", entry.timestamp, entry.log_entry);

    // Unlock the file after writing
    if (flock(fd, LOCK_UN) != 0) {
        perror("flock");
        fclose(file);
        exit(EXIT_FAILURE);
    }

    fclose(file);
}

// Actor thread function to handle log entries
void *actor(void *arg) {
    Mailbox *mailbox = (Mailbox *)arg;

    while (1) {
        // Receive log entry from mailbox
        LogEntry entry = receive_message(mailbox);
        // Append entry to the log file
        append_to_log(entry);
    }
}

// Timestamp generator (CRDT-like ordering)
unsigned long get_timestamp() {
    static unsigned long lamport_clock = 0;
    return ++lamport_clock;
}

// Read the log file
void read_log() {
    FILE *file = fopen(LOG_FILE, "r");
    if (file == NULL) {
        perror("fopen");
        return;
    }

    char line[MAX_LOG_ENTRY_SIZE + 50];
    while (fgets(line, sizeof(line), file) != NULL) {
        printf("%s", line);  // Print each log entry
    }

    fclose(file);
}

int main() {
    Mailbox mailbox;
    init_mailbox(&mailbox);

    // Create the actor thread to process log entries
    pthread_t actor_thread;
    pthread_create(&actor_thread, NULL, actor, (void *)&mailbox);

    // Simulate incoming requests to append to the log
    for (int i = 0; i < 5; i++) {
        LogEntry entry;
        snprintf(entry.log_entry, MAX_LOG_ENTRY_SIZE, "Log entry number %d", i + 1);
        entry.timestamp = get_timestamp();

        // Send the log entry to the actor's mailbox
        send_message(&mailbox, entry);

        // Sleep to simulate time between requests
        sleep(1);
    }

    // Allow the actor thread to process entries
    sleep(2);

    // Read the log
    printf("Reading the log:\n");
    read_log();

    // Join the actor thread (not necessary in this example as the actor runs forever)
    pthread_cancel(actor_thread);  // Cancel the thread for cleanup
    pthread_join(actor_thread, NULL);

    return 0;
}
