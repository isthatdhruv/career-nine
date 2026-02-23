package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.kccitm.api.model.career9.GameTable;
import com.kccitm.api.repository.Career9.GameTableRepository;

@RestController
@RequestMapping("/game-table")
public class GameTableController {

    @Autowired
    private GameTableRepository gameTableRepository;

    @GetMapping("/getAll")
    public List<GameTable> getAllGameTables() {
        return gameTableRepository.findAll();
    }

    @PostMapping("/add")
    public GameTable createGameTable(@RequestBody GameTable gameTable) {
        return gameTableRepository.save(gameTable);
    }

    @DeleteMapping("/delete/{id}")
    public void deleteGameTable(@PathVariable Long id) {
        gameTableRepository.deleteById(id);
    }

    @PostMapping("/update/{id}")
    public GameTable updateGameTable(@PathVariable Long id, @RequestBody GameTable gameTable) {
        gameTable.setGameId(id);
        return gameTableRepository.save(gameTable);
    }
}
