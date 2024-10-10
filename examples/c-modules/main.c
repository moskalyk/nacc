#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <emscripten.h>

#define BUFFER_SIZE 1024 // Adjust as needed
static char* delayed_response = NULL;

static int message_count = 0; // Counter for the number of messages received

void update_throughput() {
    // This function will be called every second to print the throughput
    printf("Throughput: %d messages per second\n", message_count);
    message_count = 0; // Reset the counter after printing
}

// Update message count function
void increment_message_count() {
    message_count++;
}

// Function to return the delayed response
EMSCRIPTEN_KEEPALIVE
const char* get_delayed_response() {
    return delayed_response; // Return the stored response
}

EMSCRIPTEN_KEEPALIVE
void free_delayed_response() {
    free(delayed_response);
    delayed_response = NULL;
}

// Process the JSON response and transform data
void process_json_response(const char* json) {
    // Find the start and end of the array
    const char* start = strstr(json, "[");
    const char* end = strstr(json, "]");

    if (start == NULL || end == NULL || start >= end) {
        printf("Invalid JSON format\n");
        return; // Return NULL for invalid input
    }

    // Calculate the size of the array
    int count = 0;
    for (const char* p = start + 1; p < end; p++) {
        if (*p == ',') {
            count++;
        }
    }
    count++; // Count the last element

    // Allocate memory for the values
    int* values = (int*)malloc(count * sizeof(int));
    if (values == NULL) {
        perror("Failed to allocate memory");
        return;
    }

    // Parse the values into the array
    char* token = strtok(strdup(start + 1), ",");
    for (int i = 0; token != NULL && i < count; i++) {
        values[i] = atoi(token);
        token = strtok(NULL, ",");
    }

    // Prepare the transformed data
    char* transformed_data = (char*)malloc(BUFFER_SIZE); // Allocate memory for transformed data
    if (transformed_data == NULL) {
        free(values);
        perror("Failed to allocate memory for transformed data");
        return;
    }

    snprintf(transformed_data, BUFFER_SIZE, "{\"data\":["); // Initialize the JSON string

    for (int i = 0; i < count; i++) {
        values[i] *= 2; // Double the value

        char buffer[12]; // Enough to hold the integer
        sprintf(buffer, "%d", values[i]);

        strncat(transformed_data, buffer, BUFFER_SIZE - strlen(transformed_data) - 1);
        if (i < count - 1) {
            strncat(transformed_data, ",", BUFFER_SIZE - strlen(transformed_data) - 1); // Add comma if not the last element
        }
    }

    strncat(transformed_data, "]}", BUFFER_SIZE - strlen(transformed_data) - 1); // Close the JSON object

    // // Output the parsed values
    // printf("Parsed values: ");
    // for (int i = 0; i < count; i++) {
    //     printf("%d ", values[i]);
    // }
    // printf("\n");

    // Free allocated memory
    free(values);
    delayed_response = strdup(transformed_data);
  // Send the transformed data back to JavaScript through WebSocket
    EM_ASM({
        var ws = new WebSocket('ws://127.0.0.1:8080');
        ws.onopen = function() {
            ws.send(UTF8ToString($0)); // Send the data back to the JavaScript WebSocket
        };
        ws.close();
    }, transformed_data);
    free(transformed_data);
}

// Main C function to initiate WebSocket connection
EMSCRIPTEN_KEEPALIVE
void my_c_function() {
    EM_ASM({
        if (typeof Module.websocket === 'undefined') {
            Module.websocket = new WebSocket('ws://127.0.0.1:8080');
            Module.websocket.onopen = function() {
                console.log('Connected to WebSocket server');
                Module.websocket.send('Hello Server');
            };

            // Function to track the number of messages received
            function startThroughputMeasurement() {
                setInterval(function() {
                    Module.ccall('update_throughput', 'void', [], []);
                }, 1000); // Call every second
            }

            Module.websocket.onmessage = function(event) {
                // Module.print('Server response: ' + event.data);
                Module.ccall('process_json_response', 'void', ['string'], [event.data]);

                // Increment the message count
                Module.ccall('increment_message_count', 'void', [], []);
            };

            Module.websocket.onerror = function(error) {
                console.error('WebSocket error:', error);
            };
            Module.websocket.onclose = function() {
                console.log('WebSocket connection closed');
            };

            // Start measuring throughput
            startThroughputMeasurement();
        }
    });
}
