package com.example.demo.dao;

import java.util.List;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import com.example.demo.dto.TranslationLog;

@Mapper
public interface TranslateResponseDao {
	
	@Insert("""
			insert into translation_log (text, confidence)
			values(#{text}, #{confidence})
			""")
	void save(@Param("text") String text, @Param("confidence") double confidence);
	
	@Select("""
			select *
				from translation_log
				order by id desc
				limit #{limit}
			""")
	List<TranslationLog> findRecent(@Param("limit") int limit);

}
