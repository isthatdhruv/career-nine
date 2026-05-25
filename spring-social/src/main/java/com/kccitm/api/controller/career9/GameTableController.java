package com.kccitm.api.controller.career9;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.access.prepost.PreAuthorize;
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
    @PreAuthorize("@auth.allows('game_table.read')")
    public List<GameTable> getAllGameTables() {
        return gameTableRepository.findAll();
    }

    @PostMapping("/add")
    @PreAuthorize("@auth.allows('game_table.create')")
    public GameTable createGameTable(@RequestBody GameTable gameTable) {
        return gameTableRepository.save(gameTable);
    }

    @DeleteMapping("/delete/{id}")
    @PreAuthorize("@auth.allows('game_table.delete')")
    public void deleteGameTable(@PathVariable Long id) {
        gameTableRepository.deleteById(id);
    }

    @PostMapping("/update/{id}")
    @PreAuthorize("@auth.allows('game_table.update')")
    public GameTable updateGameTable(@PathVariable Long id, @RequestBody GameTable gameTable) {
        gameTable.setGameId(id);
        return gameTableRepository.save(gameTable);
    }
}
