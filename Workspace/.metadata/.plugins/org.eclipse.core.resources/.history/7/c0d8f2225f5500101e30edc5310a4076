package com.example.demo.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HelloController {

    private static final Logger logger = LoggerFactory.getLogger(HelloController.class);

    @GetMapping("/api/hello")
    public String hello() {
        logger.info("'/api/hello' 엔드포인트가 호출되었습니다! 클라이언트 연결 확인.");
        return "Hello from Spring Boot!";
    }
}