package com.example.demo.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.example.demo.dao.TranslateResponseDao;
import com.example.demo.dto.TranslationLog;

@Service
public class TranslateResponseService {
	
	private final TranslateResponseDao translateResponseDao;
	
	public TranslateResponseService(TranslateResponseDao translateResponseDao) {
		this.translateResponseDao = translateResponseDao;
	}
	
	public void save(String text, double confidence) {
		this.translateResponseDao.save(text, confidence);
	}

	public List<TranslationLog> findRecent(int limit) {
		return this.translateResponseDao.findRecent(limit);
	}
	
}
