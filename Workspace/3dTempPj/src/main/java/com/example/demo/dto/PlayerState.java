package com.example.demo.dto; // 실제 프로젝트 패키지명으로 변경해주세요.

import lombok.AllArgsConstructor; // Lombok: 모든 필드를 인자로 받는 생성자를 자동 생성
import lombok.Data; // Lombok: Getter, Setter, toString, equals, hashCode 등을 자동 생성
import lombok.NoArgsConstructor; // Lombok: 기본 생성자를 자동 생성

@Data // @Getter, @Setter, @ToString, @EqualsAndHashCode, @RequiredArgsConstructor를 한 번에 제공
@NoArgsConstructor // 인자 없는 기본 생성자
@AllArgsConstructor // 모든 필드를 인자로 받는 생성자
public class PlayerState {
    private double x; // 플레이어의 X 좌표
    private double y; // 플레이어의 Y 좌표
    private double z; // 플레이어의 Z 좌표
}
