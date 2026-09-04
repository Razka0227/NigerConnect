import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { SocketService } from './core/services/socket.service';
import { ChatService } from './core/services/chat.service';
import { OfflineService } from './core/services/offline.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnInit {
  private auth = inject(AuthService);
  private socket = inject(SocketService);
  private chat = inject(ChatService);
  private offline = inject(OfflineService);

  async ngOnInit() {
    if (this.auth.isLoggedIn()) {
      await this.auth.refreshMe();
      this.socket.connect();
      this.chat.init();
      this.offline.flushOutbox();
    }
    window.addEventListener('nc:unauthorized', () => {
      window.location.hash = '#/auth';
    });
  }
}
