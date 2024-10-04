#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <openssl/sha.h>

// Node structure for the Merkle tree
typedef struct Node {
    unsigned char hash[SHA256_DIGEST_LENGTH];
    struct Node *left;
    struct Node *right;
} Node;

// Function to create a new tree node
Node* create_node(const unsigned char* data, size_t data_len) {
    Node *new_node = (Node *)malloc(sizeof(Node));
    if (!new_node) {
        fprintf(stderr, "Memory allocation failed\n");
        exit(EXIT_FAILURE);
    }
    
    // Hash the data
    SHA256(data, data_len, new_node->hash);
    new_node->left = NULL;
    new_node->right = NULL;
    
    return new_node;
}

// Function to calculate the hash of two child nodes
void calculate_hash(Node *parent, Node *left_child, Node *right_child) {
    // Concatenate the hashes of the two children
    unsigned char combined_hash[2 * SHA256_DIGEST_LENGTH];
    memcpy(combined_hash, left_child->hash, SHA256_DIGEST_LENGTH);
    memcpy(combined_hash + SHA256_DIGEST_LENGTH, right_child->hash, SHA256_DIGEST_LENGTH);
    
    // Hash the combined hash
    SHA256(combined_hash, sizeof(combined_hash), parent->hash);
}

// Function to build the Merkle tree from an array of values
Node* build_merkle_tree(unsigned char values[][SHA256_DIGEST_LENGTH], int count) {
    // If there are no values, return NULL
    if (count == 0) {
        return NULL;
    }

    // Create nodes for all leaves
    Node **nodes = (Node **)malloc(count * sizeof(Node *));
    for (int i = 0; i < count; i++) {
        nodes[i] = create_node(values[i], SHA256_DIGEST_LENGTH);
    }

    // Build the tree layer by layer
    while (count > 1) {
        int new_count = (count + 1) / 2; // Next layer count
        Node **new_nodes = (Node **)malloc(new_count * sizeof(Node *));
        
        for (int i = 0; i < count / 2; i++) {
            new_nodes[i] = (Node *)malloc(sizeof(Node));
            calculate_hash(new_nodes[i], nodes[2 * i], nodes[2 * i + 1]);
        }
        
        // Handle the odd node
        if (count % 2 == 1) {
            new_nodes[new_count - 1] = (Node *)malloc(sizeof(Node));
            memcpy(new_nodes[new_count - 1]->hash, nodes[count - 1]->hash, SHA256_DIGEST_LENGTH);
            new_nodes[new_count - 1]->left = NULL;
            new_nodes[new_count - 1]->right = NULL;
        }
        
        // Clean up old nodes and set nodes to new layer
        for (int i = 0; i < count; i++) {
            free(nodes[i]);
        }
        free(nodes);
        
        nodes = new_nodes;
        count = new_count;
    }

    Node *root = nodes[0];
    free(nodes);
    return root;
}

// Function to print the Merkle root
void print_root(Node *root) {
    if (root) {
        printf("Merkle Root: ");
        for (int i = 0; i < SHA256_DIGEST_LENGTH; i++) {
            printf("%02x", root->hash[i]);
        }
        printf("\n");
    }
}

int main() {
    unsigned char values[][SHA256_DIGEST_LENGTH] = {
        "Transaction 1",
        "Transaction 2",
        "Transaction 3",
        "Transaction 4",
    };
    
    int count = sizeof(values) / SHA256_DIGEST_LENGTH;

    // Build the Merkle tree
    Node *root = build_merkle_tree(values, count);

    // Print the Merkle root
    print_root(root);

    // Clean up
    free(root);
    
    return 0;
}
