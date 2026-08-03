package com.smartstorage.api;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * Main starting point of the Smart Storage Health Monitor backend.
 */
@SpringBootApplication
public class StorageHealthApiApplication {

    public static void main(String[] args) {
        SpringApplication.run(StorageHealthApiApplication.class, args);
    }
}