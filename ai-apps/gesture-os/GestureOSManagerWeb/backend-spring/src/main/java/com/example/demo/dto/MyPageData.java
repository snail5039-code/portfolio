package com.example.demo.dto;

import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@AllArgsConstructor
@NoArgsConstructor
public class MyPageData {
    private Member member;
    private Stats stats;
    private List<Article> myArticles;
    private List<Comment> myComments;
    private List<Article> likedArticles;

    private boolean nicknameChangeAllowed;
    private String nextNicknameChangeDate;
    private long nicknameDaysLeft;

    @Data
    @AllArgsConstructor
    @NoArgsConstructor
    public static class Stats {
        private int articleCount;
        private int commentCount;
        private int likeCount;
    }
}
