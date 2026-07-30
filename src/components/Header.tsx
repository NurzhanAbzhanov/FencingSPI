import "./Header.css";

type HeaderProps = {
    activePage:
        | "enter-results"
        | "team-spi"
        | "squad-spi"
        | "regenerate-data";
};

export default function Header({ activePage }: HeaderProps) {
    return (
        <header className="header">
            <div className="header-content">
                <a className="header-title" href="#/team-spi">
                    NCAA Fencing SPI Platform
                </a>

                <nav aria-label="Main navigation">
                    <ul className="nav-list">
                        <li>
                            <a
                                className={
                                    activePage === "enter-results" ? "active" : ""
                                }
                                href="#/enter-results"
                            >
                                Enter Results
                            </a>
                        </li>

                        <li>
                            <a
                                className={
                                    activePage === "team-spi" ? "active" : ""
                                }
                                href="#/team-spi"
                            >
                                Team SPI
                            </a>
                        </li>

                        <li>
                            <a
                                className={
                                    activePage === "squad-spi" ? "active" : ""
                                }
                                href="#/squad-spi"
                            >
                                Squad SPI
                            </a>
                        </li>

                        <li>
                            <a
                                className={
                                    activePage === "regenerate-data"
                                        ? "active"
                                        : ""
                                }
                                href="#/regenerate-data"
                            >
                                Regenerate
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
        </header>
    );
}
