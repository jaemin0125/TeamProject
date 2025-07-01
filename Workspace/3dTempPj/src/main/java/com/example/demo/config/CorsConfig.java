package com.example.demo.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class CorsConfig implements WebMvcConfigurer {

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/**") // 모든 경로에 대해 CORS 허용
                .allowedOrigins(
                    "http://localhost:5173", // 기존 로컬 개발 주소
                    "http://192.168.5.16:5173" // 당신의 로컬 네트워크 IP 주소 (추가)
                    // 만약 나중에 Netlify에서 접속할 거라면, "https://feserver.netlify.app"도 여기에 추가해야 합니다.
                )
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS") // 허용할 HTTP 메서드
                .allowedHeaders("*") // 모든 헤더 허용
                .allowCredentials(true); // 자격 증명 (쿠키, HTTP 인증 등) 허용
    }
}