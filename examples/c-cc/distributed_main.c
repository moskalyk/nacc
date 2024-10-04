#include <gcrypt.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

#define PGP_ALGO GCRY_PK_RSA
#define NUM_SERVER_KEYS 5

// Define a keyring structure for server nodes
typedef struct {
    gcry_sexp_t *priv_keys;
    gcry_sexp_t *pub_keys;
    int num_keys;
} Keyring;

// Initialize the library
void initialize_libgcrypt() {
    if (!gcry_check_version(GCRYPT_VERSION)) {
        fprintf(stderr, "libgcrypt version mismatch\n");
        exit(2);
    }
    gcry_control(GCRYCTL_DISABLE_SECMEM, 0);
    gcry_control(GCRYCTL_INITIALIZATION_FINISHED, 0);
}

// Generate a PGP key pair
void generate_pgp_keypair(gcry_sexp_t *priv_key, gcry_sexp_t *pub_key) {
    gcry_sexp_t key_params;
    gcry_error_t err;

    // Define parameters for the RSA key
    err = gcry_sexp_build(&key_params, NULL, "(genkey (rsa (nbits 4:2048)))");
    if (err) {
        fprintf(stderr, "Error generating key parameters: %s\n", gcry_strerror(err));
        exit(1);
    }

    // Generate the key pair
    err = gcry_pk_genkey(priv_key, key_params);
    if (err) {
        fprintf(stderr, "Error generating key pair: %s\n", gcry_strerror(err));
        exit(1);
    }

    // Extract the public key from the private key
    *pub_key = gcry_sexp_find_token(*priv_key, "public-key", 0);
    if (!*pub_key) {
        fprintf(stderr, "Error extracting public key from private key\n");
        exit(1);
    }

    gcry_sexp_release(key_params);
}

// Initialize the keyring
void initialize_keyring(Keyring *keyring, int num_keys) {
    keyring->priv_keys = (gcry_sexp_t *)malloc(num_keys * sizeof(gcry_sexp_t));
    keyring->pub_keys = (gcry_sexp_t *)malloc(num_keys * sizeof(gcry_sexp_t));
    keyring->num_keys = 0;
}

// Add a key pair to the keyring
void add_key_to_keyring(Keyring *keyring, gcry_sexp_t priv_key, gcry_sexp_t pub_key) {
    if (keyring->num_keys >= NUM_SERVER_KEYS) {
        fprintf(stderr, "Keyring is full. Cannot add more keys.\n");
        return;
    }

    keyring->priv_keys[keyring->num_keys] = priv_key;
    keyring->pub_keys[keyring->num_keys] = pub_key;
    keyring->num_keys++;
}

// Encrypt a message using the public key
void encrypt_message(gcry_sexp_t pub_key, const char *message, gcry_sexp_t *ciphertext) {
    gcry_error_t err;
    gcry_sexp_t data;

    // Convert the message to an S-expression (with length included for safety)
    err = gcry_sexp_build(&data, NULL, "(data (flags raw) (value %b))", strlen(message), message);
    if (err) {
        fprintf(stderr, "Error creating data sexp: %s\n", gcry_strerror(err));
        exit(1);
    }

    // Encrypt the message
    err = gcry_pk_encrypt(ciphertext, data, pub_key);
    if (err) {
        fprintf(stderr, "Encryption failed: %s\n", gcry_strerror(err));
        exit(1);
    }

    gcry_sexp_release(data);
}

// Try to decrypt the message using all the keys in the keyring
int try_decrypt_message(Keyring *keyring, gcry_sexp_t ciphertext, char *buffer, size_t buffer_len) {
    for (int i = 0; i < keyring->num_keys; i++) {
        gcry_error_t err;
        gcry_sexp_t plaintext;

        // Try to decrypt the message with the current key
        err = gcry_pk_decrypt(&plaintext, ciphertext, keyring->priv_keys[i]);
        if (!err) {  // If no error, the decryption was successful
            const char *value;
            size_t value_length;

            // Extract the decrypted value
            value = gcry_sexp_nth_data(plaintext, 0, &value_length);
            if (value && value_length < buffer_len) {
                memcpy(buffer, value, value_length);
                buffer[value_length] = '\0';  // Null-terminate the buffer
                gcry_sexp_release(plaintext);
                return 0;  // Success
            }

            gcry_sexp_release(plaintext);
        }
    }
    return 1;  // Decryption failed with all keys
}

// Free all keyring resources
void free_keyring(Keyring *keyring) {
    for (int i = 0; i < keyring->num_keys; i++) {
        gcry_sexp_release(keyring->priv_keys[i]);
        gcry_sexp_release(keyring->pub_keys[i]);
    }
    free(keyring->priv_keys);
    free(keyring->pub_keys);
}

int main() {
    initialize_libgcrypt();
    srand(time(NULL));

    // Initialize the keyring for server nodes
    Keyring server_keyring;
    initialize_keyring(&server_keyring, NUM_SERVER_KEYS);

    // Generate 5 server key pairs and add them to the keyring
    for (int i = 0; i < NUM_SERVER_KEYS; i++) {
        gcry_sexp_t server_priv_key, server_pub_key;
        generate_pgp_keypair(&server_priv_key, &server_pub_key);
        add_key_to_keyring(&server_keyring, server_priv_key, server_pub_key);
    }

    // Generate user key pair (only for decrypting the result)
    gcry_sexp_t user_priv_key, user_pub_key;
    generate_pgp_keypair(&user_priv_key, &user_pub_key);

    // Encrypt the value '10' using a randomly selected server's public key
    const char *input_value = "10";
    const char *input_value_2 = "2";
    gcry_sexp_t encrypted_input;
    gcry_sexp_t encrypted_input_2;
    int selected_key_index = rand() % server_keyring.num_keys;
    int selected_key_index_2 = rand() % server_keyring.num_keys;
    encrypt_message(server_keyring.pub_keys[selected_key_index], input_value, &encrypted_input);
    encrypt_message(server_keyring.pub_keys[selected_key_index_2], input_value_2, &encrypted_input_2);
    printf("Value '10' encrypted by server key #%d.\n", selected_key_index);
    printf("Value '2' encrypted by server key #%d.\n", selected_key_index_2);

    // Decrypt the value using the server node keys
    char decrypted_value[256];
    char decrypted_value_2[256];
    if (try_decrypt_message(&server_keyring, encrypted_input, decrypted_value, sizeof(decrypted_value)) == 0) {
        printf("Server decrypted value: %s\n", decrypted_value);
    } else {
        printf("Failed to decrypt the value with server keys.\n");
        free_keyring(&server_keyring);
        gcry_sexp_release(encrypted_input);
        return 1;
    }

    if (try_decrypt_message(&server_keyring, encrypted_input_2, decrypted_value_2, sizeof(decrypted_value_2)) == 0) {
        printf("Server decrypted value: %s\n", decrypted_value_2);
    } else {
        printf("Failed to decrypt the value with server keys.\n");
        free_keyring(&server_keyring);
        gcry_sexp_release(encrypted_input);
        return 1;
    }

    // Compute the value 2 * decrypted_value (which is 10)
    int result = atoi(decrypted_value) * atoi(decrypted_value_2);
    printf("Server computed result (2 * 10): %d\n", result);

    // Convert the result to a string for re-encryption
    char result_str[256];
    snprintf(result_str, sizeof(result_str), "%d", result);

    // Encrypt the computed result using the **user's public key**
    gcry_sexp_t encrypted_result;
    encrypt_message(user_pub_key, result_str, &encrypted_result);
    printf("Result encrypted with user's public key.\n");

    // Decrypt the result using the **user's private key**
    gcry_error_t err;
    gcry_sexp_t plaintext;
    err = gcry_pk_decrypt(&plaintext, encrypted_result, user_priv_key);
    if (!err) {  // If no error, the decryption was successful
        const char *final_value;
        size_t value_length;

        // Extract the decrypted value
        final_value = gcry_sexp_nth_data(plaintext, 0, &value_length);
        if (final_value && value_length < sizeof(result_str)) {
            memcpy(result_str, final_value, value_length);
            result_str[value_length] = '\0';  // Null-terminate the result
            printf("User decrypted result: %s\n", result_str);
        }
        gcry_sexp_release(plaintext);
    } else {
        printf("Failed to decrypt the result with user's private key.\n");
    }

    // Clean up
    free_keyring(&server_keyring);
    gcry_sexp_release(user_priv_key);
    gcry_sexp_release(user_pub_key);
    gcry_sexp_release(encrypted_input);
    gcry_sexp_release(encrypted_result);

    return 0;
}
