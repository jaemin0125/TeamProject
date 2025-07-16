package com.example.demo.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
            // 1. CORS 설정을 SecurityFilterChain의 가장 우선으로 적용
            .cors(cors -> cors.configurationSource(corsConfigurationSource()))
            // 2. CSRF 보호 비활성화 (Stateless API 서버이므로)
            .csrf(csrf -> csrf.disable())
            // 3. 모든 요청에 대해 접근 허용 (개발용)
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().permitAll()
            );
        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        // 허용할 출처(Origin) 목록
        configuration.setAllowedOrigins(Arrays.asList("http://localhost:5173", "https://7ae1617320eb.ngrok-free.app", "http://192.168.5.16:5173"));
        // 허용할 HTTP 메서드
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
        // 허용할 헤더
        configuration.setAllowedHeaders(Arrays.asList("*"));
        // 자격 증명(쿠키, 인증 헤더 등) 허용
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        // 모든 경로("/**")에 대해 위의 CORS 설정을 적용
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
